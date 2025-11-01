package com.cityu.srcspring.controller;

import com.cityu.srcspring.model.dto.TaskCreateDTO;
import com.cityu.srcspring.model.vo.TaskVO;
import com.cityu.srcspring.service.TasksService;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tasks")
public class TasksController {

    @Autowired
    private TasksService tasksService;

    // 创建任务
    @PostMapping("/create")
    public TaskVO createTask(@RequestBody TaskCreateDTO dto) {
        return tasksService.createTask(dto);
    }

    // 获取任务详情
    @GetMapping("/{id}")
    public TaskVO getTask(@PathVariable UUID id) {
        return tasksService.getTaskById(id);
    }

    // 更新任务，目前这个方法有点问题
    @PutMapping("/{id}")
    public TaskVO updateTask(@PathVariable UUID id, @RequestBody TaskCreateDTO dto) {
        return tasksService.updateTask(id, dto);
    }

    //给任务添加sprint_id
    @PutMapping("/{id}/sprint")
    public Boolean updateTaskbysprintId(@PathVariable UUID id, @RequestParam Integer sprintId) {
      try {
        return tasksService.updateTaskbysprintId(id, sprintId);
      } catch (JsonProcessingException e) {
        throw new RuntimeException(e);
      }

    }

    // 删除任务
    @DeleteMapping("/{id}")
    public boolean deleteTask(@PathVariable UUID id) {
        return tasksService.deleteTask(id);
    }

    // 查询所有任务（或按项目过滤）
    @GetMapping
    public List<TaskVO> getAllTasks(@RequestParam(required = false) UUID projectId) {
        return tasksService.getAllTasks(projectId);
    }

    // 根据 sprint_id 获取任务列表
    @GetMapping("/bysprint")
    public List<TaskVO> getTasksBySprint(@RequestParam Integer sprintId) {
        return tasksService.getTasksBySprintId(sprintId);
    }

}
