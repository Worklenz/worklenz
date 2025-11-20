package com.cityu.srcspring.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TaskCreateDTO {
    private String name;
    private String description;
    private UUID projectId;
    private UUID reporterId;
    private UUID statusId;
    private UUID priorityId;
    private UUID parentTaskId;
    private Boolean billable;
    private Double totalMinutes;
    private String startDate;
    private String endDate;
    private String progressMode;


    // 可选的关联信息
    private List<String> assignees;
    private List<String> labels;
    private List<String> attachments;

    // sprint_id 可选，前端创建时默认空
    private Integer sprintId;
}
