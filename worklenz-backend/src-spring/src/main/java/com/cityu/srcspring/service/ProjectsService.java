package com.cityu.srcspring.service;

import com.cityu.srcspring.dto.ProjectsDTO;

import java.util.UUID;

public interface ProjectsService {
    //delete

    //根据id查name
    String getNameById(UUID id);

    String getKeyByName(String name);

    boolean add(ProjectsDTO projectsDTO);
    boolean delete(UUID id);

    Object getProjectsByPage(int page, int size);
}
