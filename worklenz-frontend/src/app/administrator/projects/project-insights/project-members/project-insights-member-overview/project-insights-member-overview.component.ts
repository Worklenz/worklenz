import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {formatDate} from '@angular/common';
import {ProjectInsightsComponent} from '../../project-insights.component';

@Component({
  selector: 'worklenz-project-insights-member-overview',
  templateUrl: './project-insights-member-overview.component.html',
  styleUrls: ['./project-insights-member-overview.component.scss']
})
export class ProjectInsightsMemberOverviewComponent {
  @ViewChild('membersInsights') membersInsights: ElementRef | undefined;
  @Input() archived = false;

  private readonly includeArchivedTasks = "include-archived-tasks";

  constructor(
    private projectInsightsComponent: ProjectInsightsComponent,
  ) {
  }

  exportMembersInsight(projectName: string | null) {

    if (this.membersInsights) {

      this.projectInsightsComponent.isLoading = true;

      html2canvas(this.membersInsights.nativeElement).then((canvas) => {

        let img = canvas.toDataURL("image/PNG");
        let doc = new jsPDF('p', 'mm', 'a4', true);
        const bufferX = 5;
        const bufferY = 28;
        const imgProps = (<any>doc).getImageProperties(img);
        const pdfWidth = doc.internal.pageSize.getWidth() - 2 * bufferX;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let LogoImg = new Image();
        LogoImg.src = location.origin + '/assets/images/logo.png';
        doc.addImage(LogoImg, 'PNG', (doc.internal.pageSize.getWidth() / 2) - 12, 5, 30, 6.5);
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0, 0.85);
        doc.text([`Insights - ` + projectName + ` - Members`, `${formatDate(new Date(), 'yyyy-MM-dd', 'en')}`], 105, 17, {
          maxWidth: pdfWidth,
          align: 'center'
        });
        doc.addImage(img, 'PNG', bufferX, bufferY, pdfWidth, pdfHeight);
        return doc;

      }).then((doc) => {

        doc.save('Members Insights ' + formatDate(new Date(), 'yyyy-MM-dd', 'en') + '.pdf');
        this.projectInsightsComponent.isLoading = false;

      });
    }
  }
}
