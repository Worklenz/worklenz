package com.cityu.srcspring.model.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;



/**
 * 任务实体类，对应数据库表 tasks
 */
@Data
@TableName("tasks")
@AllArgsConstructor
@NoArgsConstructor
public class Tasks {

    @TableId(value = "id", type = IdType.INPUT)
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

    private Integer sortOrder;

    private Integer roadmapSortOrder;

    private Integer statusSortOrder;

    private Integer prioritySortOrder;

    private Integer phaseSortOrder;

    private Boolean billable;

    private UUID scheduleId;

    private Boolean manualProgress;

    private Integer progressValue;

    private Integer weight;

    @TableField(value = "progress_mode")
    private String progressMode;




    private Integer sprintId;
}
