package com.cityu.srcspring.service;

import com.cityu.srcspring.model.dto.SprintDTO;
import com.cityu.srcspring.model.entity.Sprints;
import com.fasterxml.jackson.core.JsonProcessingException;

import java.util.List;
import java.util.UUID;

public interface SprintsService {
    boolean delete(Integer id);

    boolean add(Sprints sprints);

    SprintDTO get(Integer id) throws JsonProcessingException;

    Object page(int page, int size);

    boolean update(Sprints sprints);

    List<SprintDTO> getByProjectId(UUID projectId);


  Sprints get1(Integer id);
}
