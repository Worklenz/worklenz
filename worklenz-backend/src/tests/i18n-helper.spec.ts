import { initializeI18n } from "../config/i18n";
import { I18nHelper } from "../shared/i18n-helper";
import { ExternalNotificationsService } from "../services/external-notifications.service";

describe("I18nHelper and Backend i18n", () => {
  beforeAll(async () => {
    await initializeI18n();
  });

  describe("Notifications Translation", () => {
    it("should translate notification message in English", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "en",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> has assigned you to <b>Design System</b>");
    });

    it("should translate notification message in German", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "de",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> hat Ihnen <b>Design System</b> zugewiesen");
    });

    it("should translate notification message in French", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "fr",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> vous a assigné à <b>Design System</b>");
    });

    it("should translate notification message in Polish", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "pl",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> przypisał(a) Cię do <b>Design System</b>");
    });

    it("should translate notification message in Spanish", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "es",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> te ha asignado en <b>Design System</b>");
    });

    it("should translate notification message in Portuguese", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "pt",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> atribuiu-lhe <b>Design System</b>");
    });

    it("should translate notification message in Albanian", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "alb",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> ju ka caktuar në <b>Design System</b>");
    });

    it("should translate notification message in Chinese", () => {
      const text = I18nHelper.translate(
        "notifications.taskAssigned",
        "zh",
        { reporter: "Alice", task: "Design System" }
      );
      expect(text).toBe("<b>Alice</b> 已将 <b>Design System</b> 指派给您");
    });
  });

  describe("External Integrations (Slack & Teams)", () => {
    it("should translate Slack message titles in English and Spanish", () => {
      const textEn = I18nHelper.translate("external.slack.task_created.title", "en");
      expect(textEn).toBe("Task Created");

      const textEs = I18nHelper.translate("external.slack.task_created.title", "es");
      expect(textEs).toBe("Tarea creada");
    });

    it("should translate Teams fields in French and German", () => {
      const textFr = I18nHelper.translate("external.teams.assignees", "fr");
      expect(textFr).toBe("Assignés");

      const textDe = I18nHelper.translate("external.teams.assignees", "de");
      expect(textDe).toBe("Zugewiesene");
    });

    it("should format Slack message with localized strings in Spanish", () => {
      const taskData = {
        task_id: "t1",
        task_name: "Auth Feature",
        project_id: "p1",
        project_name: "Core App",
        status_name: "In Progress",
        status_color: "#3AA3E3",
        assignee_names: ["Bob"],
        task_url: "http://localhost/task"
      };

      const slackEs = (ExternalNotificationsService as any).formatSlackMessage(
        "task_created",
        taskData,
        "Alice",
        "es"
      );
      expect(slackEs.text).toContain("Tarea creada");
      expect(slackEs.blocks[0].text.text).toContain("Tarea creada");
      expect(slackEs.blocks[0].accessory.text.text).toBe("Ver tarea");
    });

    it("should format Teams message with localized strings in French", () => {
      const taskData = {
        task_id: "t1",
        task_name: "Auth Feature",
        project_id: "p1",
        project_name: "Core App",
        status_name: "In Progress",
        assignee_names: ["Bob"],
        task_url: "http://localhost/task"
      };

      const teamsFr = (ExternalNotificationsService as any).formatTeamsMessage(
        "task_created",
        taskData,
        "Alice",
        "fr"
      );
      const card = teamsFr.attachments[0].content;
      expect(card.body[0].text).toContain("Tâche créée");
      expect(card.body[2].actions[0].title).toBe("Afficher la tâche");
    });
  });

  describe("Key normalization and fallbacks", () => {
    it("should support both dot notation and colon namespace notation", () => {
      const dotNotation = I18nHelper.translate(
        "notifications.commentAdded",
        "en",
        { user: "Bob", task: "API Docs" }
      );
      const colonNotation = I18nHelper.translate(
        "notifications:commentAdded",
        "en",
        { user: "Bob", task: "API Docs" }
      );
      expect(dotNotation).toBe("<b>Bob</b> added a comment on <b>API Docs</b>");
      expect(colonNotation).toBe(dotNotation);
    });

    it("should fallback gracefully if translation key is missing", () => {
      const fallbackText = I18nHelper.translate(
        "notifications.nonExistentKey",
        "en",
        { defaultValue: "Default Notification" }
      );
      expect(fallbackText).toBe("Default Notification");
    });
  });
});
