import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {BaseChartDirective} from "ng2-charts";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import {ActiveElement, Chart, ChartConfiguration} from "chart.js";
import {log_error} from "@shared/utils";
import {ReportingApiService} from "../../../../reporting-api.service";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {ReportingService} from "../../../../reporting.service";
import {IRPTTimeProject} from "../../../../interfaces";
import {ISelectableProject} from "@interfaces/selectable-project";
import moment from "moment/moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";

@Component({
  selector: 'worklenz-time-projects',
  templateUrl: './time-projects.component.html',
  styleUrls: ['./time-projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeProjectsComponent implements OnInit, OnChanges {
  @ViewChild(BaseChartDirective) barChart: BaseChartDirective | undefined;
  @ViewChild('exportChartCanvas') exportChartCanvas!: ElementRef;

  visible = false;
  loading = false;
  loadingTeams = false;
  loadingCategories = false;
  loadingProjects = false;
  selectAllTeams = true;
  selectAllCategories = true;
  selectAllProjects = true;
  selectNoCategory = true;
  isDurationLabelSelected = true;

  chartHeight = 600;
  chartWidth = 1080;

  teamSearchText: string | null = null;
  projectSearchText: string | null = null;
  categorySearchText: string | null = null;
  selectedProject: IRPTTimeProject | null = null;

  showLogsModal = false;

  teamsDropdown: IProjectCategoryViewModel[] = [];
  categoriesDropdown: IProjectCategoryViewModel[] = [];
  projectsDropdown: ISelectableProject[] = [];

  projectColors: string[] = [];

  projects: IRPTTimeProject[] = [];

  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{data: [], label: 'Logged Time (hours) ', backgroundColor: this.projectColors, barThickness: 40}]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        color: 'white',
        anchor: 'start',
        align: 'right',
        offset: 20,
        textStrokeColor: 'black',
        textStrokeWidth: 4,
      }
    },
    backgroundColor: "black",
    indexAxis: "y",
    scales: {
      y: {
        title: {
          display: true,
          text: 'Projects',
          align: "end",
          font: {
            family: 'Helvetica'
          }
        },
        ticks: {
          callback: function (value) {
            return this.getLabelForValue(parseFloat(<string>value)).substr(0, 30);
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Logged Time(hours)',
          align: "end",
          font: {
            family: 'Helvetica'
          }
        },
      }
    },
    onClick: (event: any, elements: ActiveElement[], chart: Chart) => {
      this.ngZone.run(() => {
        const bars = chart.getElementsAtEventForMode(
          event,
          'nearest',
          {intersect: true},
          true
        );

        if (bars.length === 0) return;
        const bar = bars[0];
        const index = bar.index;
        this.openTimeLogs(index);
      });
    }
  };

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly api: ReportingApiService,
    private readonly ngZone: NgZone,
  ) {
    merge(
      this.service.onDurationChange,
      this.service.onDateRangeChange,
      this.service.onIncludeToggleChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        void this.get();
      });
  }

  ngOnInit() {
    this.chartWidth = window.innerWidth - 250;
    void this.getTeams();
    this.cdr.markForCheck();
  }

  async refreshCategories() {
    await this.getCategories(this.getSelectedTeamIds());
    void this.refreshProjects();
  }

  async refreshProjects() {
    await this.getAllocationProjects(this.getSelectedTeamIds(), this.getSelectedCategories());
    void this.get();
  }

  private getSelectedTeamIds(): string[] {
    const filter = this.teamsDropdown.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  private getSelectedCategories(): string[] {
    const filter = this.categoriesDropdown.filter(c => c.selected);
    const ids = filter.map(c => c.id) as string[];
    return ids || [];
  }

  private getSelectedProjectIds(): string[] {
    const filter = this.projectsDropdown.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  async getCategories(teams: string[]) {
    try {
      this.loadingCategories = true;
      const res = await this.api.getCategories(teams);
      if (res.done) {
        this.categoriesDropdown = res.body;
      }
      this.loadingCategories = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingCategories = false;
      this.cdr.markForCheck();
    }
  }

  async getAllocationProjects(teams: string[], categories: string[]) {
    try {
      this.loadingProjects = true;
      const res = await this.api.getAllocationProjects(teams, categories, this.selectNoCategory);
      if (res.done) {
        this.projectsDropdown = res.body;
      }
      this.loadingProjects = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingProjects = false;
      this.cdr.markForCheck();
    }
  }

  private async getTeams() {
    try {
      this.loadingTeams = true;
      const res = await this.api.getOverviewTeams();
      if (res.done) {
        this.loadingTeams = false;
        const teams = [];
        for (const team of res.body) {
          teams.push({selected: true, name: team.name, id: team.id})
        }
        this.teamsDropdown = teams;
        void this.refreshCategories();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loadingTeams = false;
      this.cdr.markForCheck();
    }
  }

  private async setDatesForKeys() {
    if(this.service.getDuration()?.key) {
      const key = this.service.getDuration()?.key;
      const today = moment();

      switch (key) {
        case YESTERDAY:
          const yesterday = moment().subtract(1, "days");
          this.service.setDateRange([yesterday.toString(), yesterday.toString()]);
          break;
        case LAST_WEEK:
          const lastWeekStart = moment().subtract(1, "weeks");
          this.service.setDateRange([lastWeekStart.toString(), today.toString()]);
          break;
        case LAST_MONTH:
          const lastMonthStart = moment().subtract(1, "months");
          this.service.setDateRange([lastMonthStart.toString(), today.toString()]);
          break;
        case LAST_QUARTER:
          const lastQuaterStart = moment().subtract(3, "months");
          this.service.setDateRange([lastQuaterStart.toString(), today.toString()]);
          break;
        case PREV_WEEK:
          const prevWeekStart = moment().subtract(1, "weeks").startOf("week");
          const prevWeekEnd = moment().subtract(1, "weeks").endOf("week");
          this.service.setDateRange([prevWeekStart.toString(), prevWeekEnd.toString()]);
          break;
        case PREV_MONTH:
          const prevMonthStart = moment().subtract(1, "month").startOf("month");
          const prevMonthEnd = moment().subtract(1, "month").endOf("month");
          this.service.setDateRange([prevMonthStart.toString(), prevMonthEnd.toString()]);
          break;
      }
    }
  }

  async get() {
    try {
      this.loading = true;

      const teams = this.getSelectedTeamIds();
      const categories = this.getSelectedCategories();
      const projects = this.getSelectedProjectIds();

      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }

      const body = {
        teams,
        categories,
        projects,
        duration: this.service.getDuration()?.key,
        date_range: this.service.getDateRange()
      }
      const res = await this.api.getProjectTimeSheets(body, this.service.getIncludeToggle());
      if (res.done) {
        if (this.barChartData) {
          this.barChartData.datasets[0].data = [];
          this.barChartData.labels = [];
        }
        this.projects = res.body;
        if (res.body.length) {
          const containerHeight = window.innerHeight - 300;
          const virtualHeight = res.body.length * 60;
          if (virtualHeight > containerHeight) {
            this.chartHeight = virtualHeight;
          } else {
            this.chartHeight = window.innerHeight - 300;
          }
        }
        this.createChart();
        this.loading = false;
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e);
      this.cdr.markForCheck();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    setTimeout(() => {
      this.barChart?.update();
      this.cdr.markForCheck();
    }, 1000)
  }

  createChart() {
    this.visible = true;
    for (const project of this.projects) {
      this.projectColors.push(project.color_code);
      this.barChartData.labels?.push(project.name);
      this.barChartData.datasets[0].data.push(project.value || 0);
    }
    this.barChart?.update();
    this.cdr.markForCheck();
  }

  onFilterChange() {
    void this.get();
  }

  detectChanges() {
    this.cdr.markForCheck();
  }

  async export() {
    const chartElement = this.exportChartCanvas.nativeElement;
    const image = chartElement.toDataURL("image/png").replace("image/png", "image/octet-stream")
    const a = document.createElement('a');
    const filename = 'Projects time sheet.png';
    a.setAttribute("href", image);
    a.setAttribute('download', filename);
    a.click();
  }

  checkTeam() {
    this.selectAllTeams = false
    void this.refreshCategories();
  }

  checkCategory() {
    this.selectAllCategories = false
    void this.refreshProjects();
  }

  checkProject() {
    this.selectAllProjects = false
    this.onFilterChange();
  }

  selectAllTeamsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.teamsDropdown) {
        item.selected = true;
      }
      void this.refreshCategories();
      this.cdr.markForCheck();
    } else {
      for (const item of this.teamsDropdown) {
        item.selected = false;
      }
      void this.refreshCategories();
      this.cdr.markForCheck();
    }
  }

  selectAllCategoriesChecked(checked: boolean) {
    if (checked) {
      this.selectNoCategory = true;
      for (const item of this.categoriesDropdown) {
        item.selected = true;
      }
      void this.refreshProjects();
      this.cdr.markForCheck();
    } else {
      this.selectNoCategory = false;
      for (const item of this.categoriesDropdown) {
        item.selected = false;
      }
      void this.refreshProjects();
      this.cdr.markForCheck();
    }
  }

  selectAllProjectsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.projectsDropdown) {
        item.selected = true;
      }
      this.onFilterChange();
      this.cdr.markForCheck();
    } else {
      for (const item of this.projectsDropdown) {
        item.selected = false;
      }
      this.onFilterChange();
      this.cdr.markForCheck();
    }
  }

  openTimeLogs(index: number) {
    const project = this.projects[index];
    this.selectedProject = project;
    this.showLogsModal = true;
    this.cdr.detectChanges();
  }

}
