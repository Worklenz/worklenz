package com.cityu.srcspring.dao.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cityu.srcspring.model.entity.Sprints;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

public interface SprintsMapper extends BaseMapper<Sprints> {
  @Update("UPDATE sprints SET subtask = #{subtask}::jsonb WHERE id = #{id}")
  int updateSubtask(@Param("id") Integer id, @Param("subtask") String subtask);


}
