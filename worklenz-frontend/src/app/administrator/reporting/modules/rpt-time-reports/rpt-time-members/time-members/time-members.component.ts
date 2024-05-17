import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {BaseChartDirective} from "ng2-charts";
import {Chart, ChartConfiguration} from "chart.js";
import {log_error} from "@shared/utils";
import {ISelectableProject} from "@interfaces/selectable-project";
import {ISelectableTeam} from "@interfaces/selectable-team";
import {ReportingApiService} from "../../../../reporting-api.service";
import {ReportingService} from "../../../../reporting.service";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IRPTTimeMember} from "../../../../interfaces";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import moment from "moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";

@Component({
  selector: 'worklenz-time-members',
  templateUrl: './time-members.component.html',
  styleUrls: ['./time-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeMembersComponent implements OnInit, OnChanges {
  @ViewChild(BaseChartDirective) barChart: BaseChartDirective | undefined;
  @ViewChild('exportChartCanvas') exportChartCanvas!: ElementRef;

  visible = false;
  loading = false;
  loadingTeams = false;
  loadingCategories = false;
  loadingProjects = false;
  selectAllTeams = true;
  selectAllProjects = true;
  selectAllCategories = true;
  selectNoCategory = true;
  isDurationLabelSelected = true;

  chartHeight = 600;
  chartWidth = 1080;

  teamSearchText: string | null = null;
  categorySearchText: string | null = null;
  projectSearchText: string | null = null;

  teams: ISelectableTeam[] = [];
  projects: ISelectableProject[] = [];
  categoriesDropdown: IProjectCategoryViewModel[] = [];

  barChartPlugins = [];
  memberColors: string[] = [];
  members: IRPTTimeMember[] = [];

  exportChart: Chart | null = null;

  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{data: [], label: 'Logged Time (hours) ', backgroundColor: this.memberColors, barThickness: 40}]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    // responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        color: 'white',
        font: {
          weight: 'bold'
        },
        anchor: 'start',
        align: 'right',
        offset: 20,
        borderColor: "#000",
        textStrokeColor: 'black',
        textStrokeWidth: 4,
      }
    },
    indexAxis: "y",
    scales: {
      y: {
        title: {
          display: true,
          text: 'Member',
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
        }
      }
    }
  };

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly service: ReportingService,
    private readonly api: ReportingApiService,
  ) {
    merge(
      this.service.onDurationChange,
      this.service.onDateRangeChange,
      this.service.onIncludeToggleChange
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.barChartData)
          this.barChartData.datasets[0].data = [];
        this.barChartData.labels = [];
        void this.get();
      });
  }

  ngOnInit() {
    this.chartWidth = window.innerWidth - 250;
    void this.getTeams();
    this.cdr.markForCheck();
  }

  private getSelectedTeamIds(): string[] {
    const filter = this.teams.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
  }

  private getSelectedCategories(): string[] {
    const filter = this.categoriesDropdown.filter(c => c.selected);
    const ids = filter.map(c => c.id) as string[];
    return ids || [];
  }

  private getSelectedProjectIds(): string[] {
    const filter = this.projects.filter(t => t.selected);
    const ids = filter.map(t => t.id) as string[];
    return ids || [];
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
      const projects = this.getSelectedProjectIds();

      if (this.isDurationLabelSelected) {
        await this.setDatesForKeys();
      }

      const body = {
        teams,
        projects,
        duration: this.service.getDuration()?.key,
        date_range: this.service.getDateRange()
      }
      const res = await this.api.getMemberTimeSheets(body, this.service.getIncludeToggle());
      if (res.done) {
        if (this.barChartData)
          this.barChartData.datasets[0].data = [];
        this.barChartData.labels = [];

        this.members = res.body;
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
        this.cdr.markForCheck();
      }
      this.loading = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loading = false;
      log_error(e);
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
        this.teams = teams;
        await this.refreshCategories();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loadingTeams = false;
      this.cdr.markForCheck();
    }
  }

  async refreshCategories() {
    await this.getCategories(this.getSelectedTeamIds());
    void this.refreshProjects();
  }

  async refreshProjects() {
    await this.getProjects(this.getSelectedTeamIds(), this.getSelectedCategories());
    void this.get();
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

  async getProjects(teams: string[], categories: string[]) {
    try {
      this.loadingProjects = true;
      const res = await this.api.getAllocationProjects(teams, categories, this.selectNoCategory);
      if (res.done) {
        this.projects = res.body;
      }
      this.loadingProjects = false;
      this.cdr.markForCheck();
    } catch (e) {
      this.loadingProjects = false;
      this.cdr.markForCheck();
    }
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges) {
    setTimeout(() => {
      this.barChart?.update();
      this.cdr.markForCheck();
    }, 1000)
  }

  createChart() {
    this.visible = true;
    for (const member of this.members) {
      this.barChartData.labels?.push(member.name);
      this.barChartData.datasets[0].data.push(member.value || 0);
      this.memberColors.push(member.color_code);
    }
    this.barChart?.update();
    this.createExportChart();
    this.cdr.markForCheck();
  }

  onTeamsFilterChange() {
    void this.get();
  }

  detectChanges() {
    this.cdr.markForCheck();
  }

  createExportChart() {
    this.exportChart?.destroy();
    const chartElement = this.exportChartCanvas.nativeElement;
    this.exportChart = new Chart(chartElement, {
      type: 'bar',
      data: this.barChartData,
      options: this.barChartOptions,
    });
    this.exportChart?.update();
    this.cdr.markForCheck();
  }

  async export() {
    const chartElement = this.exportChartCanvas.nativeElement;
    const image = chartElement.toDataURL("image/png").replace("image/png", "image/octet-stream")
    const a = document.createElement('a');
    const filename = 'Members time sheet.png';
    a.setAttribute("href", image);
    a.setAttribute('download', filename);
    a.click();
  }

  checkTeam() {
    this.selectAllTeams = false
    this.refreshCategories();
  }

  checkCategory() {
    this.selectAllCategories = false
    void this.refreshProjects();
  }

  checkProject() {
    this.selectAllProjects = false
    this.onTeamsFilterChange();
  }

  selectAllTeamsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.teams) {
        item.selected = true;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    } else {
      for (const item of this.teams) {
        item.selected = false;
      }
      this.refreshProjects();
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
      for (const item of this.projects) {
        item.selected = true;
      }
      this.onTeamsFilterChange();
      this.cdr.markForCheck();
    } else {
      for (const item of this.projects) {
        item.selected = false;
      }
      this.onTeamsFilterChange();
      this.cdr.markForCheck();
    }
  }

}
