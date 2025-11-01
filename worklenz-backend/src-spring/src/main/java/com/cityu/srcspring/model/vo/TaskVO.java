package com.cityu.srcspring.model.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TaskVO {

  // ============ 基础字段 ============
  private UUID id;
  private String name;
  private String description;

  private Boolean done;
  private Double totalMinutes;
  private Boolean archived;
  private Long taskNo;

  private OffsetDateTime startDate;
  private OffsetDateTime endDate;

  private UUID priorityId;
  private UUID projectId;
  private UUID reporterId;
  private UUID parentTaskId;
  private UUID statusId;

  private OffsetDateTime completedAt;
  private OffsetDateTime createdAt;
  private OffsetDateTime updatedAt;

  private Boolean billable;
  private Boolean manualProgress;
  private Integer progressValue;
  private Integer weight;

  private String progressMode;

  private UUID scheduleId;
  private Integer sprintId;

  // ============ 排序字段 ============
  private Integer sortOrder;
  private Integer roadmapSortOrder;
  private Integer statusSortOrder;
  private Integer prioritySortOrder;
  private Integer phaseSortOrder;

  // ============ 扩展/衍生字段 ============
  private String status;           // statusId → task_statuses.name
  private String priorityName;     // priorityId → priorities.name
  private String parentTaskName;   // parentTaskId → tasks.name
  private String projectName;      // projectId → projects.name
  private String reporterName;     // reporterId → users.name
  private List<String> assignees;  // 任务执行人列表
  private List<String> labels;     // 标签名列表
}
