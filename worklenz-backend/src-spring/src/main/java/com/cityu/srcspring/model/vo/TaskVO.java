package com.cityu.srcspring.model.vo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TaskVO {
    private UUID id;
    private String name;
    private String description;
    private UUID statusId;
    private UUID priorityId;
    private UUID projectId;
    private UUID reporterId;
    private UUID parentTaskId;
    private Boolean done;
    private Boolean archived;
    private Boolean billable;
    private Double totalMinutes;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime completedAt;
    private Integer sprintId;
    private String progressMode;

    // 扩展字段（可以动态 join 或在 service 层填充）
    private String status;        // statusId 对应 task_statuses.name
    private String priorityName;  // priorityId 对应 priorities.name
    private String parentTaskName; // parentTaskId 对应 tasks.name
    private String projectName;
    private String reporterName;
    private List<String> assignees;
    private List<String> labels;
}
