package com.cityu.srcspring.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.cityu.srcspring.entity.ProjectType;
import com.cityu.srcspring.mapper.ProjectTypeMapper;
import com.cityu.srcspring.service.ProjectTypeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ProjectTypeServiceImpl implements ProjectTypeService {
    @Autowired
    private ProjectTypeMapper projectTypeMapper;

    @Override
    public boolean delete(String name) {
        return projectTypeMapper.delete(
                new QueryWrapper<ProjectType>().eq("name", name)
        ) > 0;
    }
}
