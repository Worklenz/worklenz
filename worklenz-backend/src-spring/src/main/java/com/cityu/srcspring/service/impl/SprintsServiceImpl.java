package com.cityu.srcspring.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cityu.srcspring.dao.mapper.TasksMapper;
import com.cityu.srcspring.model.dto.SprintDTO;
import com.cityu.srcspring.model.entity.Projects;
import com.cityu.srcspring.model.entity.Sprints;
import com.cityu.srcspring.dao.mapper.ProjectsMapper;
import com.cityu.srcspring.dao.mapper.SprintsMapper;
import com.cityu.srcspring.model.entity.Tasks;
import com.cityu.srcspring.model.vo.TaskVO;
import com.cityu.srcspring.service.SprintsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.ibatis.type.TypeReference;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SprintsServiceImpl implements SprintsService {
    @Autowired
    private SprintsMapper sprintsMapper;
    @Autowired
    private ProjectsMapper projectsMapper;
    @Autowired
    private TasksMapper taskMapper;

    @Override
    public boolean delete(Integer id) {
        return sprintsMapper.deleteById(id) > 0;
    }
    @Override
    public boolean add(Sprints sprints) {
        return sprintsMapper.insert(sprints) > 0;
    }

  private final ObjectMapper objectMapper = new ObjectMapper();
  @Override
  public SprintDTO get(Integer id) {
    Sprints sprint = sprintsMapper.selectById(id);
    if (sprint == null) return null;

    SprintDTO dto = new SprintDTO();
    BeanUtils.copyProperties(sprint, dto);

    // ⚙️ JSON 转换器
    ObjectMapper objectMapper = new ObjectMapper();
    objectMapper.registerModule(new JavaTimeModule());
    objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // 🧩 反序列化 JSONB -> List<TaskVO>
    if (sprint.getSubtask() != null && !sprint.getSubtask().isEmpty()) {
      try {
        List<TaskVO> tasks = objectMapper.readValue(
          sprint.getSubtask(),
          objectMapper.getTypeFactory().constructCollectionType(List.class, TaskVO.class)
        );
        dto.setSubtask(tasks);
      } catch (Exception e) {
        e.printStackTrace();
        dto.setSubtask(Collections.emptyList());
      }
    } else {
      dto.setSubtask(Collections.emptyList());
    }

    // 🏗️ 关联 project 名称
    Projects project = projectsMapper.selectById(sprint.getProjectId());
    dto.setProjectName(project != null ? project.getName() : null);

    return dto;
  }



  @Override
  public Object page(int page, int size) {
    Page<Sprints> sprintPage = sprintsMapper.selectPage(new Page<>(page, size), null);

    ObjectMapper objectMapper = new ObjectMapper();
    objectMapper.registerModule(new JavaTimeModule());
    objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    List<SprintDTO> result = sprintPage.getRecords().stream().map(sprint -> {
      SprintDTO dto = new SprintDTO();
      BeanUtils.copyProperties(sprint, dto);

      // ⚙️ JSONB -> List<TaskVO>
      if (sprint.getSubtask() != null && !sprint.getSubtask().isEmpty()) {
        try {
          List<TaskVO> tasks = objectMapper.readValue(
            sprint.getSubtask(),
            objectMapper.getTypeFactory().constructCollectionType(List.class, TaskVO.class)
          );
          dto.setSubtask(tasks);
        } catch (Exception e) {
          e.printStackTrace();
          dto.setSubtask(Collections.emptyList());
        }
      } else {
        dto.setSubtask(Collections.emptyList());
      }

      // 🏗️ 关联 project 名称
      Projects project = projectsMapper.selectById(sprint.getProjectId());
      dto.setProjectName(project != null ? project.getName() : null);

      return dto;
    }).collect(Collectors.toList());

    Map<String, Object> pageResult = new HashMap<>();
    pageResult.put("total", sprintPage.getTotal());
    pageResult.put("records", result);

    return pageResult;
  }



    @Override
    public boolean update(Sprints sprints) {
        return sprintsMapper.updateById(sprints) > 0;
    }

    @Override
    public List<SprintDTO> getByProjectId(UUID projectId) {
        List<Sprints> sprints = sprintsMapper.selectList(new QueryWrapper<Sprints>().eq("project_id", projectId));
        Projects project = projectsMapper.selectById(projectId);

        return sprints.stream().map(sprint -> {
            SprintDTO dto = new SprintDTO();
            BeanUtils.copyProperties(sprint, dto);
            dto.setProjectName(project != null ? project.getName() : null);
            return dto;
        }).collect(Collectors.toList());
    }

  @Override
  public Sprints get1(Integer id) {
    return sprintsMapper.selectById(id);
  }


}
