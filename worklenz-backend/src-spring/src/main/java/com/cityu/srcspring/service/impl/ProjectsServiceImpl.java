package com.cityu.srcspring.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cityu.srcspring.model.dto.ProjectsDTO;
import com.cityu.srcspring.model.entity.Projects;
import com.cityu.srcspring.dao.mapper.ProjectsMapper;
import com.cityu.srcspring.service.ProjectsService;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;
@Service
public class ProjectsServiceImpl implements ProjectsService {
    @Autowired
    private ProjectsMapper projectsMapper;


    @Override
    public String getNameById(UUID id) {
        return projectsMapper.selectById(id).getName();
    }

    @Override
    public String getKeyByName(String name) {
        LambdaQueryWrapper<Projects> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.select(Projects::getName, Projects::getKey)
                .eq(Projects::getName, name);

        Projects project = projectsMapper.selectOne(queryWrapper);

        if (project == null) {
            return "未找到该项目";
        }

        return "name=" + project.getName() + ", key=" + project.getKey();
    }

    @Override
    public boolean add(ProjectsDTO projectsDTO) {
        if (projectsDTO == null) {
            return false;
        }

        Projects project = new Projects();

        // 1️⃣ 复制相同属性名的字段
        BeanUtils.copyProperties(projectsDTO, project);

        // 2️⃣ 手动设置特殊字段
        project.setId(UUID.randomUUID());
        project.setCreatedAt(OffsetDateTime.now()); // 默认系统时区
        project.setUpdatedAt(OffsetDateTime.now());
        project.setOwnerId(projectsDTO.getProjectManagerId()); // DTO 的 projectManagerId -> 实体的 ownerId

        // 3️⃣ 插入数据库
        int rows = projectsMapper.insert(project);
        return rows > 0;
    }

    @Override
    public boolean delete(UUID id) {
        return  projectsMapper.deleteById(id) > 0;
    }

    @Override
    public Object getProjectsByPage(int page, int size) {
        Page<Projects> pageParam= new Page<>(page, size);
        return projectsMapper.selectPage(pageParam, null);

    }

    @Override
    public UUID getProject_idByName(String name) {
        LambdaQueryWrapper<Projects> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.select(Projects::getName, Projects::getId)
                .eq(Projects::getName, name);
                Projects project = projectsMapper.selectOne(queryWrapper);
                return project.getId();


    }

}
