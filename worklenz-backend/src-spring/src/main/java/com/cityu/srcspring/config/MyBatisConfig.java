package com.cityu.srcspring.config;

import com.baomidou.mybatisplus.autoconfigure.ConfigurationCustomizer;
import com.cityu.srcspring.handler.UUIDTypeHandler;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.UUID;

@Configuration
@MapperScan("com.cityu.srcspring.dao.mapper")


public class MyBatisConfig {

    @Bean
    public ConfigurationCustomizer configurationCustomizer() {
        return configuration -> {
            // 注册 UUID 处理器
            configuration.getTypeHandlerRegistry()
                    .register(UUID.class, new UUIDTypeHandler());

  };
    }
}
