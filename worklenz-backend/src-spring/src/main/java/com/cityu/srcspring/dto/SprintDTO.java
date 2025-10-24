package com.cityu.srcspring.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SprintDTO {

    private Integer id;
    private UUID projectId;
    private String projectName; // DTO 专用
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private String goal;

}
