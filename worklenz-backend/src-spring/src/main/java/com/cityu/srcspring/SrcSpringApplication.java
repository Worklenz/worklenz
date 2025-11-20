package com.cityu.srcspring;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Configuration;


@MapperScan("com.cityu.srcspring.dao.mapper")

@SpringBootApplication
public class SrcSpringApplication {

  public static void main(String[] args) {
    SpringApplication.run(SrcSpringApplication.class, args);
  }

}
