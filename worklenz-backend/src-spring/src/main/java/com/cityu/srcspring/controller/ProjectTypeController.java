package com.cityu.srcspring.controller;

import com.cityu.srcspring.service.ProjectTypeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class ProjectTypeController {
  // 接口路径：/api/hello
  @Autowired
  private ProjectTypeService projectTypeService;
  //delete
  @GetMapping("/api/delete")
  public String delete(String name) {
    return projectTypeService.delete(name) ? "删除成功" : "删除失败";
  }

}
