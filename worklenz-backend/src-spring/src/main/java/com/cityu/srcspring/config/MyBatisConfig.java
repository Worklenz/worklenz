package com.cityu.srcspring.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.autoconfigure.ConfigurationCustomizer;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.cityu.srcspring.handler.UUIDTypeHandler;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.UUID;

@Configuration
@MapperScan("com.cityu.srcspring.dao.mapper")
public class MyBatisConfig {

  /**
   * ✅ 注册 MyBatis-Plus 拦截器（分页插件）
   */
  @Bean
  public MybatisPlusInterceptor mybatisPlusInterceptor() {
    MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
    // ⚙️ 根据你的数据库类型选择对应的 DbType
    interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.POSTGRE_SQL));
    return interceptor;
  }

  /**
   * ✅ 注册 UUID 类型处理器
   */
  @Bean
  public ConfigurationCustomizer configurationCustomizer() {
    return configuration -> {
      configuration.getTypeHandlerRegistry()
        .register(UUID.class, new UUIDTypeHandler());
    };
  }



}
