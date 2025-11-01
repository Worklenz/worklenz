package com.cityu.srcspring.controller;

import com.cityu.srcspring.model.dto.SprintDTO;
import com.cityu.srcspring.model.entity.Sprints;
import com.cityu.srcspring.service.SprintsService;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/sprints")
public class SprintsController {
    @Autowired
    private SprintsService sprintsService;
    @DeleteMapping("/delete/{id}")
    public String delete(@PathVariable Integer id) {
        return sprintsService.delete(id) ? "删除成功" : "删除失败";
    }
    //新增
    @RequestMapping("/add")
    public String add(@RequestBody Sprints sprints) {
        return sprintsService.add(sprints) ? "添加成功" : "添加失败";
    }
    //查询
    @RequestMapping("/get")
    public SprintDTO get(@RequestParam Integer id) throws JsonProcessingException {
        return sprintsService.get(id);
    }
  @RequestMapping("/get1")
  public Sprints get1(@RequestParam Integer id) {
    return sprintsService.get1(id);
  }

    //修改
    @RequestMapping("/update")
    public String update(@RequestBody Sprints sprints) {
        return sprintsService.update(sprints) ? "修改成功" : "修改失败";
    }

    //分页
    @RequestMapping("/page")
    public Object page(@RequestParam(defaultValue = "1") int page,
                       @RequestParam(defaultValue = "10") int size) {
        return sprintsService.page(page, size);
    }

    //根据project_id返回sprints
    @RequestMapping("/getByProjectId")
    public List<SprintDTO> getByProjectId(@RequestParam UUID project_id) {
        return sprintsService.getByProjectId(project_id);
    }




}
