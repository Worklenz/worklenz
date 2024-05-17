import {ChangeDetectorRef, Component, ElementRef, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {BaseChartDirective} from "ng2-charts";
import {IProjectCategoryViewModel} from "@interfaces/project-category";
import {Chart, ChartConfiguration} from "chart.js";
import {log_error} from "@shared/utils";
import {ReportingService} from "../../../../reporting.service";
import {ReportingApiService} from "../../../../reporting-api.service";
import {merge} from "rxjs";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {IRPTTimeProject} from "../../../../interfaces";
import {ISelectableProject} from "@interfaces/selectable-project";
import moment from "moment";
import {LAST_MONTH, LAST_QUARTER, LAST_WEEK, PREV_MONTH, PREV_WEEK, YESTERDAY} from "@shared/constants";

enum IToggleOptions {
  'WORKING_DAYS', 'MAN_DAYS'
}

@Component({
  selector: 'worklenz-time-estimation-vs-actual-projects',
  templateUrl: './time-estimation-vs-actual-projects.component.html',
  styleUrls: ['./time-estimation-vs-actual-projects.component.scss']
})
export class TimeEstimationVsActualProjectsComponent implements OnInit, OnChanges {
  @ViewChild(BaseChartDirective) barChart: BaseChartDirective | undefined;
  @ViewChild('chartContainer') chartContainer!: ElementRef;
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
  categorySearchText: string | null = null;
  projectSearchText: string | null = null;
  tabTitle: string | null = "Working Days";

  teamsDropdown: IProjectCategoryViewModel[] = [];
  categoriesDropdown: IProjectCategoryViewModel[] = [];
  projectsDropdown: ISelectableProject[] = [];

  barChartPlugins = [];
  projects: IRPTTimeProject[] = [];
  toggleOptions = ['Working Days', 'Man Days'];
  type = 0;

  exportChart: Chart | null = null;
  baseChart: Chart | null = null;

  barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {data: [], label: 'Estimated Days ', backgroundColor: '#A5AAD9', barThickness: 50},
      {data: [], label: 'Actual Days ', backgroundColor: '#c191cc', barThickness: 50},
    ]
  };

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    maintainAspectRatio: false,
    scales: {
      y: {
        title: {
          display: true,
          text: 'Days',
          align: "end",
          font: {
            family: 'Helvetica'
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Project',
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
    },
    plugins: {
      tooltip: {
        callbacks: {
          footer: (items) => {
            if (items.length > 0) {
              const project = this.projects[items[0].dataIndex];
              if (project.end_date) return 'Ends On: ' + moment(project.end_date).format("MMM, DD YYYY");
            }
            return '';
          },
        }
      },
      datalabels: {
        color: 'white',
        anchor: 'start',
        align: 'start',
        offset: -30,
        borderColor: "#000",
        textStrokeColor: 'black',
        textStrokeWidth: 4,
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
        void this.get();
      });
  }

  ngOnInit() {
    this.chartHeight = window.innerHeight - 300;
    void this.getTeams();
    this.cdr.markForCheck();
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
        await this.refreshCategories();
        this.cdr.markForCheck();
      }
    } catch (e) {
      log_error(e);
      this.loadingTeams = false;
      this.cdr.markForCheck();
    }
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
        type: IToggleOptions[this.type],
        teams,
        categories,
        selectNoCategory: this.selectNoCategory,
        projects,
        duration: this.service.getDuration()?.key,
        date_range: this.service.getDateRange()
      }
      const res = await this.api.getProjectEstimatedVsActual(body, this.service.getIncludeToggle());
      if (res.done) {
        if (this.barChartData) {
          this.barChartData.datasets[0].data = [];
          this.barChartData.datasets[1].data = [];
          this.barChartData.labels = [];
        }
        this.loading = false;
        this.projects = res.body;

        this.createChart();
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

  ngOnChanges(changes: SimpleChanges) {
    setTimeout(() => {
      this.barChart?.update("");
      this.cdr.markForCheck();
    }, 1000)
  }

  createChart() {
    this.visible = true;
    for (const project of this.projects) {
      this.barChartData.labels?.push(project.name);
      this.barChartData.datasets[0].data.push(project.estimated_value || 0);
      this.barChartData.datasets[1].data.push(project.value || 0);
    }
    if (this.projects.length) {
      const containerWidth = window.innerWidth - 300;
      const virtualWidth = this.projects.length * 120;
      if (virtualWidth > containerWidth) {
        this.chartWidth = virtualWidth;
      } else {
        this.chartWidth = window.innerWidth - 250;
      }
    }
    this.barChart?.update("none");
    this.createExportChart();
    this.cdr.markForCheck();
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

  async refreshCategories() {
    await this.getCategories(this.getSelectedTeamIds());
    void this.refreshProjects();
  }

  async refreshProjects() {
    await this.getProjects(this.getSelectedTeamIds(), this.getSelectedCategories());
    void this.get();
  }

  async getProjects(teams: string[], categories: string[]) {
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
    this.cdr.markForCheck();
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
    const filename = 'Estimated vs Actual.png';
    a.setAttribute("href", image);
    a.setAttribute('download', filename);
    a.click();
  }

  onFilterChange() {
    void this.get();
  }

  handleIndexChange(e: number): void {
    this.type = e;
    this.get();
  }

  selectAllTeamsChecked(checked: boolean) {
    if (checked) {
      for (const item of this.teamsDropdown) {
        item.selected = true;
      }
      this.refreshCategories();
      this.cdr.markForCheck();
    } else {
      for (const item of this.teamsDropdown) {
        item.selected = false;
      }
      this.refreshCategories();
      this.cdr.markForCheck();
    }
  }

  selectAllCategoriesChecked(checked: boolean) {
    if (checked) {

      this.selectNoCategory = true;
      for (const item of this.categoriesDropdown) {
        item.selected = true;
      }
      this.refreshProjects();
      this.cdr.markForCheck();
    } else {
      this.selectNoCategory = false;
      for (const item of this.categoriesDropdown) {
        item.selected = false;
      }
      this.refreshProjects();
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

}

