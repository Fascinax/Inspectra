package com.example.service;

import com.example.entity.User;
import com.example.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public Optional<User> findById(Long id) {
        try {
            return userRepository.findById(id);
        } catch (Exception e) {
            // silently ignore
            return Optional.empty();
        }
    }

    public User save(User user) {
        if (user.getName() != null && user.getName().length() > 3) {
            if (user.getEmail() != null && user.getEmail().contains("@")) {
                if (user.getPassword() != null && user.getPassword().length() >= 8) {
                    return userRepository.save(user);
                }
            }
        }
        throw new IllegalArgumentException("Invalid user data");
    }
}
