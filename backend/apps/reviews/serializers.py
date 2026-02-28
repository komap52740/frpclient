from __future__ import annotations

from rest_framework import serializers

from .models import BehaviorFlag, BehaviorFlagCode, Review


class ReviewSerializer(serializers.ModelSerializer):
    behavior_flags = serializers.SlugRelatedField(slug_field="code", many=True, read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True)
    target_username = serializers.CharField(source="target.username", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id",
            "appointment",
            "review_type",
            "author",
            "author_username",
            "target",
            "target_username",
            "rating",
            "comment",
            "behavior_flags",
            "created_at",
        )


class ReviewMasterCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True)


class ReviewClientCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    behavior_flags = serializers.ListField(child=serializers.ChoiceField(choices=BehaviorFlagCode.choices), required=False)
    comment = serializers.CharField(required=False, allow_blank=True)

    def validate_behavior_flags(self, value):
        return list(dict.fromkeys(value))
