package com.cityu.srcspring.service;

import com.cityu.srcspring.dto.TaskCreateDTO;
import com.cityu.srcspring.vo.TaskVO;
import java.util.List;
import java.util.UUID;

public interface TasksService {
    TaskVO createTask(TaskCreateDTO dto);
    TaskVO getTaskById(UUID id);
    TaskVO updateTask(UUID id, TaskCreateDTO dto);
    boolean deleteTask(UUID id);
    List<TaskVO> getAllTasks(UUID projectId);

    Boolean updateTaskbysprintId(UUID id, Integer sprintId);
}
