package com.cityu.srcspring.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.cityu.srcspring.dao.mapper.SprintsMapper;
import com.cityu.srcspring.model.dto.SprintDTO;
import com.cityu.srcspring.model.dto.TaskCreateDTO;
import com.cityu.srcspring.model.entity.Sprints;
import com.cityu.srcspring.model.entity.Tasks;
import com.cityu.srcspring.dao.mapper.TasksMapper;
import com.cityu.srcspring.service.SprintsService;
import com.cityu.srcspring.service.TasksService;
import com.cityu.srcspring.model.vo.TaskVO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TasksServiceImpl implements TasksService {

    @Autowired
    private TasksMapper tasksMapper;

    @Autowired
    private SprintsMapper sprintsMapper;

    @Autowired
    private SprintsService sprintsService;
    @Override
    public TaskVO createTask(TaskCreateDTO dto) {
        Tasks task = new Tasks();
        BeanUtils.copyProperties(dto, task);

        // ✅ 手动处理时间字段（String → OffsetDateTime）
        if (dto.getStartDate() != null)
            task.setStartDate(OffsetDateTime.parse(dto.getStartDate()));
        if (dto.getEndDate() != null)
            task.setEndDate(OffsetDateTime.parse(dto.getEndDate()));

        task.setDone(false);
        task.setId(UUID.randomUUID());
        task.setProgressMode("default");

        tasksMapper.insert(task);

        TaskVO vo = new TaskVO();
        BeanUtils.copyProperties(task, vo);
        return vo;
    }

    @Override
    public TaskVO getTaskById(UUID id) {
        Tasks task = tasksMapper.selectById(id);
        TaskVO vo = new TaskVO();
        BeanUtils.copyProperties(task, vo);

        // 填充关联字段名称
        if (task.getStatusId() != null) {
            vo.setStatus(tasksMapper.selectStatusNameById(task.getStatusId()));
        }
        if (task.getPriorityId() != null) {
            vo.setPriorityName(tasksMapper.selectPriorityNameById(task.getPriorityId()));
        }
        if (task.getParentTaskId() != null) {
            vo.setParentTaskName(tasksMapper.selectTaskNameById(task.getParentTaskId()));
        }
        if(task.getReporterId() != null){
            vo.setReporterName(tasksMapper.selecUserNameById(task.getReporterId()));
        }
        if(task.getProjectId()!= null){
            vo.setProjectName(tasksMapper.selectProjectNameById(task.getProjectId()));
        }

        return vo;
    }

    @Override
    public TaskVO updateTask(UUID id, TaskCreateDTO dto) {
        Tasks task = tasksMapper.selectById(id);

        // 先拷贝除了枚举以外的字段
        BeanUtils.copyProperties(dto, task, "progressMode");

        // 单独处理枚举字段

        if (dto.getProgressMode() != null) {
            task.setProgressMode("default");

        }

        tasksMapper.updateById(task);

        TaskVO vo = new TaskVO();
        BeanUtils.copyProperties(task, vo);
        return vo;
    }

    @Override
    public boolean deleteTask(UUID id) {
        return tasksMapper.deleteById(id) > 0;
    }

    @Override
    public List<TaskVO> getAllTasks(UUID projectId) {
        QueryWrapper<Tasks> wrapper = new QueryWrapper<>();
        if (projectId != null) wrapper.eq("project_id", projectId);
        List<Tasks> list = tasksMapper.selectList(wrapper);
        return list.stream().map(task -> {
            TaskVO vo = new TaskVO();
            BeanUtils.copyProperties(task, vo);
            // 填充关联字段名称
            if (task.getStatusId() != null) {
                vo.setStatus(tasksMapper.selectStatusNameById(task.getStatusId()));
            }
            if (task.getPriorityId() != null) {
                vo.setPriorityName(tasksMapper.selectPriorityNameById(task.getPriorityId()));
            }
            if (task.getParentTaskId() != null) {
                vo.setParentTaskName(tasksMapper.selectTaskNameById(task.getParentTaskId()));
            }
            if(task.getReporterId() != null){
                vo.setReporterName(tasksMapper.selecUserNameById(task.getReporterId()));
            }
            if(task.getProjectId()!= null){
                vo.setProjectName(tasksMapper.selectProjectNameById(task.getProjectId()));
            }

            return vo;
        }).collect(Collectors.toList());
    }




  @Override
    public List<TaskVO> getTasksBySprintId(Integer sprintId) {
        List<Tasks> tasks = tasksMapper.selectTasksBySprintId(sprintId);
        return tasks.stream().map(task -> {
            TaskVO vo = new TaskVO();
            BeanUtils.copyProperties(task, vo);

            if (task.getStatusId() != null) {
                vo.setStatus(tasksMapper.selectStatusNameById(task.getStatusId()));
            }
            if (task.getPriorityId() != null) {
                vo.setPriorityName(tasksMapper.selectPriorityNameById(task.getPriorityId()));
            }
            if (task.getParentTaskId() != null) {
                vo.setParentTaskName(tasksMapper.selectTaskNameById(task.getParentTaskId()));
            }
            if(task.getReporterId() != null){
                vo.setReporterName(tasksMapper.selecUserNameById(task.getReporterId()));
            }
            if(task.getProjectId()!= null){
                vo.setProjectName(tasksMapper.selectProjectNameById(task.getProjectId()));
            }

            return vo;
        }).toList();
    }







  @Override
  public Boolean updateTaskbysprintId(UUID taskId, Integer sprintId) {
    Tasks task = tasksMapper.selectById(taskId);
    if (task == null) return false;

    // 先保存旧 sprint_id
    Integer oldSprintId = task.getSprintId();

    task.setSprintId(sprintId);
    if (tasksMapper.updateById(task) <= 0) return false;

    ObjectMapper objectMapper = new ObjectMapper();
    objectMapper.registerModule(new JavaTimeModule());
    objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // 更新新 Sprint
    List<TaskVO> newSprintTasks = this.getTasksBySprintId(sprintId);
    try {
      sprintsMapper.updateSubtask(sprintId, objectMapper.writeValueAsString(newSprintTasks));
    } catch (Exception e) {
      e.printStackTrace();
    }

    // 如果旧 sprint_id 不为空且和新 sprint_id 不同，则更新旧 Sprint
    if (oldSprintId != null && !oldSprintId.equals(sprintId)) {
      List<TaskVO> oldSprintTasks = this.getTasksBySprintId(oldSprintId);
      try {
        sprintsMapper.updateSubtask(oldSprintId, objectMapper.writeValueAsString(oldSprintTasks));
      } catch (Exception e) {
        e.printStackTrace();
      }
    }

    return true;
  }










}
