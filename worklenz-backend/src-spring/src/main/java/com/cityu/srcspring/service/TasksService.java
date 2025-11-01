package com.cityu.srcspring.service;

import com.cityu.srcspring.model.dto.TaskCreateDTO;
import com.cityu.srcspring.model.vo.TaskVO;
import com.fasterxml.jackson.core.JsonProcessingException;

import java.util.List;
import java.util.UUID;

public interface TasksService {
    TaskVO createTask(TaskCreateDTO dto);
    TaskVO getTaskById(UUID id);
    TaskVO updateTask(UUID id, TaskCreateDTO dto);
    boolean deleteTask(UUID id);
    List<TaskVO> getAllTasks(UUID projectId);
    // 新增：根据 sprint_id 获取任务列表
    List<TaskVO> getTasksBySprintId(Integer sprintId);

    Boolean updateTaskbysprintId(UUID id, Integer sprintId) throws JsonProcessingException;
}
