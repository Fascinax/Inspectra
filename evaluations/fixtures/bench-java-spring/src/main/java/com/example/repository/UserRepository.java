package com.example.repository;

import com.example.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("UPDATE User u SET u.active = false WHERE u.loginAttempts > 5")
    void deactivateInactiveUsers();

    List<User> findByDepartmentId(Long departmentId);
}
