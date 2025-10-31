package com.cityu.srcspring.controller;

import com.cityu.srcspring.model.dto.ProjectsDTO;
import com.cityu.srcspring.service.ProjectsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class ProjectsController {
    @Autowired
    private ProjectsService projectsService;

    //delete
    @DeleteMapping("/projects/delete")
    public String delete(@RequestParam UUID id) {

        return projectsService.delete(id) ? "删除成功" : "删除失败";
    }
    @GetMapping("/projects/getNameById")
    public String getNameById(@RequestParam UUID id) {
        return "name is" + projectsService.getNameById(id);
    }
    //没啥用
    @GetMapping("/projects/getkeybyName")
    public String getkeybyName(@RequestParam String name) {
        String key = projectsService.getKeyByName(name);
        return key != null ? key : "未找到该项目";
    }
    @PostMapping("/projects/add")
    public String add(@RequestBody ProjectsDTO projectsDTO) {
        return projectsService.add(projectsDTO) ? "添加成功" : "添加失败";
    }


    @GetMapping("/projects/page")
    public Object getProjectsByPage(@RequestParam(defaultValue = "1") int page,
                                    @RequestParam(defaultValue = "10") int size) {
        return projectsService.getProjectsByPage(page, size);
    }
    //根据name找project
    @GetMapping("/projects/getProjectByName")
    public UUID getProjectByName(@RequestParam String name) {
        return  projectsService.getProject_idByName(name);
    }






}
