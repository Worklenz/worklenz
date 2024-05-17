export interface ICustomProjectTemplateCreateRequest {
        project_id: string,
        templateName: string,
        projectIncludes: {
          statuses: boolean,
          phases: boolean,
          labels: boolean
        },
        taskIncludes: {
          status: boolean,
          phase: boolean,
          labels: boolean,
          estimation: boolean,
          description: boolean,
          subtasks: boolean
        }
      }
