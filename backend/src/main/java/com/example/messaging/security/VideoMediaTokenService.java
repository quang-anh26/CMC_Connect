package com.example.messaging.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class VideoMediaTokenService {
    @Value("${app.jwt.secret}")
    private String secret;

    public String issue(Long postId, Long viewerId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(viewerId.toString())
                .claim("videoId", postId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .signWith(key())
                .compact();
    }

    public Long viewerId(String token, Long expectedPostId) {
        Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
        Object videoIdClaim = claims.get("videoId");
        if (!(videoIdClaim instanceof Number videoIdNumber)) {
            throw new IllegalArgumentException("Invalid video ID claim");
        }
        Long videoId = videoIdNumber.longValue();
        if (!expectedPostId.equals(videoId)) throw new IllegalArgumentException("Media token does not match video");
        return Long.valueOf(claims.getSubject());
    }

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
