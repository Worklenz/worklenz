package com.cityu.srcspring.model.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.ibatis.type.JdbcType;

import java.time.LocalDate;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class Sprints {

  private Integer id;
  private UUID projectId;
  private String name;
  private LocalDate startDate;
  private LocalDate endDate;
  private String goal;

  // 直接用 String 接收 jsonb
  @TableField(jdbcType = JdbcType.OTHER)
  private String subtask;

}
