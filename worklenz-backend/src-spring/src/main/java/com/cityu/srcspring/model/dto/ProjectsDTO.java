package com.cityu.srcspring.model.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
public class ProjectsDTO {

    private String name;
    private String colorCode;
    private UUID statusId;
    private UUID categoryId; // 可以为 null
    private UUID healthId;
    private String notes;
    private String key;
    private UUID clientId;
    private String clientName;
    private OffsetDateTime startDate;
    private OffsetDateTime endDate;
    private Integer workingDays;
    private Integer manDays;
    private Integer hoursPerDay;

    // project_manager 对象，这里只接收 id
    private UUID projectManagerId;

    private Boolean useManualProgress;
    private Boolean useWeightedProgress;
    private Boolean useTimeProgress;
}
