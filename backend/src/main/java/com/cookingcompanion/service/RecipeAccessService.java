package com.cookingcompanion.service;

import com.cookingcompanion.domain.Dish;
import com.cookingcompanion.domain.RecipeVariant;
import com.cookingcompanion.security.CurrentRecipeRequestContext;
import com.cookingcompanion.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RecipeAccessService {

    private final CurrentRecipeRequestContext ctx;

    public RecipeAccessService(CurrentRecipeRequestContext ctx) {
        this.ctx = ctx;
    }

    public void assertCanReadDish(Dish d) {
        var scope = ctx.householdScopeId();
        var user = ctx.userId();
        UUID hid = d.getHouseholdId();
        if (hid != null) {
            if (scope.isEmpty() || !scope.get().equals(hid)) {
                throw new ApiException(
                        HttpStatus.FORBIDDEN, "Household scope does not match this recipe library");
            }
            return;
        }
        if (user.isEmpty()) {
            if (d.getOwnerUserId() != null) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
            }
            return;
        }
        if (d.getOwnerUserId() != null && !d.getOwnerUserId().equals(user.get())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed to access this dish");
        }
    }

    public void assertCanReadVariant(RecipeVariant v) {
        assertCanReadDish(v.getDish());
    }

    public void assertCanWriteDish(Dish d) {
        assertCanReadDish(d);
        var user = ctx.userId();
        if (d.getHouseholdId() != null) {
            if (user.isEmpty()) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
            }
            return;
        }
        if (d.getOwnerUserId() == null) {
            return;
        }
        if (user.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (!d.getOwnerUserId().equals(user.get())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed to modify this dish");
        }
    }
}
