package com.cityu.srcspring.model.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;


@TableName("projects")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Projects {

    @TableId(value = "id", type = IdType.INPUT)
    private UUID id;  // UUID 类型

    @TableField("name")
    private String name;

    @TableField("key")
    private String key;

    @TableField("color_code")
    private String colorCode;

    @TableField("notes")
    private String notes;

    @TableField("tasks_counter")
    private Long tasksCounter;

    @TableField("start_date")
    private OffsetDateTime startDate;

    @TableField("end_date")
    private OffsetDateTime endDate;

    @TableField("team_id")
    private UUID teamId;

    @TableField("client_id")
    private UUID clientId;

    @TableField("owner_id")
    private UUID ownerId;

    @TableField("status_id")
    private UUID statusId;

    @TableField("created_at")
    private OffsetDateTime createdAt;

    @TableField("updated_at")
    private OffsetDateTime updatedAt;

    @TableField("category_id")
    private UUID categoryId;

    @TableField("folder_id")
    private UUID folderId;

    @TableField("phase_label")
    private String phaseLabel;

    @TableField("estimated_man_days")
    private Integer estimatedManDays;

    @TableField("hours_per_day")
    private Integer hoursPerDay;

    @TableField("health_id")
    private UUID healthId;

    @TableField("estimated_working_days")
    private Integer estimatedWorkingDays;

    @TableField("use_manual_progress")
    private Boolean useManualProgress;

    @TableField("use_weighted_progress")
    private Boolean useWeightedProgress;

    @TableField("use_time_progress")
    private Boolean useTimeProgress;

    @TableField("project_type")
    private String projectTypeId;
}
