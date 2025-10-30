package com.cityu.srcspring.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cityu.srcspring.entity.Projects;
import org.apache.ibatis.annotations.Select;
import org.springframework.data.repository.query.Param;

public interface ProjectsMapper extends BaseMapper<Projects> {

    @Select("SELECT * FROM projects WHERE id = CAST(#{id} AS uuid)")
    Projects selectByUUID(@Param("id") String id);  // 接收 String
}
