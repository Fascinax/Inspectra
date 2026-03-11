package com.example.service;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    @Lazy
    private final OrderService self;

    public OrderService(@Lazy OrderService self) {
        this.self = self;
    }

    public void processOrder(Long orderId) {
        // FIXME: this self-injection is a workaround for @Transactional proxy
        self.doProcess(orderId);
    }

    public void doProcess(Long orderId) {
        // TODO: implement order processing logic
        System.out.println("Processing order: " + orderId);
    }
}
