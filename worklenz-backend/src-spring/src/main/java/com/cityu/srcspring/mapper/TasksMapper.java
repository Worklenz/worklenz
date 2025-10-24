package com.cityu.srcspring.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cityu.srcspring.entity.ProjectType;
import com.cityu.srcspring.entity.Tasks;
import org.apache.ibatis.annotations.Select;

import java.util.UUID;

public interface TasksMapper extends BaseMapper<Tasks> {
    // 查询 status name
    @Select("SELECT name FROM task_statuses WHERE id = #{id}")
    String selectStatusNameById(UUID id);

    // 查询 priority name
    @Select("SELECT name FROM task_priorities WHERE id = #{id}")
    String selectPriorityNameById(UUID id);

    // 查询 parent task name
    @Select("SELECT name FROM tasks WHERE id = #{id}")
    String selectTaskNameById(UUID id);

    @Select("SELECT name FROM users WHERE id = #{id}")
    String selecUserNameById(UUID id);

    @Select("SELECT name FROM projects WHERE id = #{id}")
    String selectProjectNameById(UUID id);
}
