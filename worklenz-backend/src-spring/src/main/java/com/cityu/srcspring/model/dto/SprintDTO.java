package com.cityu.srcspring.model.dto;

import com.cityu.srcspring.model.vo.TaskVO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SprintDTO {

  private Integer id;
  private UUID projectId;
  private String projectName;
  private String name;
  private LocalDate startDate;
  private LocalDate endDate;
  private String goal;

 private List<TaskVO> subtask;

}
