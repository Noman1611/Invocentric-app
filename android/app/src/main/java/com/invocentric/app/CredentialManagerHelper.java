package com.invocentric.app;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.CancellationSignal;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialCustomException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialInterruptedException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.GetCredentialUnknownException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.Executor;

public class CredentialManagerHelper {
    private static final String TAG = "CredentialManagerHelper";

    public static class AuthResult {
        public String idToken;
        public String email;
        public String displayName;
        public String givenName;
        public String familyName;
        public String photoUrl;
        public String phoneNumber;
        public String nonce;
    }

    public interface AuthCallback {
        void onSuccess(AuthResult result);
        void onCancel();
        void onError(String code, String message);
    }

    public interface SignOutCallback {
        void onComplete();
    }

    private final Activity activity;
    private final CredentialManager credentialManager;

    public CredentialManagerHelper(Activity activity) {
        this.activity = activity;
        this.credentialManager = CredentialManager.create(activity);
    }

    public static String generateSecureNonce() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return input;
        }
    }

    public String resolveServerClientId(@Nullable String overrideClientId) {
        if (overrideClientId != null && !overrideClientId.trim().isEmpty()) {
            return overrideClientId.trim();
        }

        try {
            int resId = activity.getResources().getIdentifier("default_web_client_id", "string", activity.getPackageName());
            if (resId != 0) {
                String id = activity.getString(resId);
                if (id != null && !id.trim().isEmpty() && !id.contains("YOUR_WEB_CLIENT_ID")) {
                    return id.trim();
                }
            }
        } catch (Exception ignored) {}

        try {
            int customResId = activity.getResources().getIdentifier("google_web_client_id", "string", activity.getPackageName());
            if (customResId != 0) {
                String id = activity.getString(customResId);
                if (id != null && !id.trim().isEmpty()) {
                    return id.trim();
                }
            }
        } catch (Exception ignored) {}

        return null;
    }

    public void signIn(
            @Nullable String overrideServerClientId,
            @Nullable String customNonce,
            boolean filterByAuthorizedAccounts,
            boolean autoSelectEnabled,
            @NonNull final AuthCallback callback
    ) {
        final String serverClientId = resolveServerClientId(overrideServerClientId);
        if (serverClientId == null) {
            callback.onError(
                    "MISSING_SERVER_CLIENT_ID",
                    "Google Web Client ID (default_web_client_id) not configured. Please add google-services.json to android/app or define default_web_client_id in strings.xml."
            );
            return;
        }

        final String rawNonce = (customNonce != null && !customNonce.trim().isEmpty())
                ? customNonce.trim()
                : generateSecureNonce();
        final String hashedNonce = sha256Hex(rawNonce);

        executeSignInRequest(serverClientId, rawNonce, hashedNonce, filterByAuthorizedAccounts, autoSelectEnabled, callback);
    }

    private void executeSignInRequest(
            final String serverClientId,
            final String rawNonce,
            final String hashedNonce,
            final boolean filterByAuthorizedAccounts,
            final boolean autoSelectEnabled,
            @NonNull final AuthCallback callback
    ) {
        try {
            GetGoogleIdOption.Builder optionBuilder = new GetGoogleIdOption.Builder()
                    .setServerClientId(serverClientId)
                    .setFilterByAuthorizedAccounts(filterByAuthorizedAccounts)
                    .setAutoSelectEnabled(autoSelectEnabled);

            if (hashedNonce != null && !hashedNonce.isEmpty()) {
                optionBuilder.setNonce(hashedNonce);
            }

            GetGoogleIdOption googleIdOption = optionBuilder.build();

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build();

            CancellationSignal cancellationSignal = new CancellationSignal();
            Executor mainExecutor = ContextCompat.getMainExecutor(activity);

            credentialManager.getCredentialAsync(
                    activity,
                    request,
                    cancellationSignal,
                    mainExecutor,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(GetCredentialResponse response) {
                            handleCredentialResponse(response, rawNonce, callback);
                        }

                        @Override
                        public void onError(GetCredentialException e) {
                            Log.w(TAG, "Credential Manager error (filterAuthorized=" + filterByAuthorizedAccounts + "): " + e.getClass().getSimpleName() + " - " + e.getMessage());

                            if (e instanceof GetCredentialCancellationException) {
                                Log.i(TAG, "User dismissed/cancelled Google Sign-In prompt.");
                                callback.onCancel();
                                return;
                            }

                            // If returning-user flow was attempted and failed because no authorized account exists,
                            // fall back immediately to full account chooser
                            if (filterByAuthorizedAccounts) {
                                Log.i(TAG, "No previously authorized accounts found. Falling back to account chooser...");
                                executeSignInRequest(serverClientId, rawNonce, hashedNonce, false, false, callback);
                                return;
                            }

                            if (e instanceof NoCredentialException) {
                                callback.onError(
                                        "NO_CREDENTIAL",
                                        "No Google account found on this device. Please add a Google account in device Settings and try again."
                                );
                            } else if (e instanceof GetCredentialProviderConfigurationException) {
                                callback.onError(
                                        "PROVIDER_CONFIG_ERROR",
                                        "Google Play Services configuration error. Please update Google Play Services and verify the OAuth Web Client ID."
                                );
                            } else if (e instanceof GetCredentialInterruptedException) {
                                callback.onError(
                                        "INTERRUPTED",
                                        "Google Sign-In was interrupted. Please try again."
                                );
                            } else {
                                callback.onError(
                                        "AUTH_FAILED",
                                        "Google Sign-In failed: " + e.getMessage()
                                );
                            }
                        }
                    }
            );
        } catch (Exception e) {
            Log.e(TAG, "Failed to start CredentialManager sign in", e);
            callback.onError("EXCEPTION", "Unable to launch Google Sign-In: " + e.getMessage());
        }
    }

    private void handleCredentialResponse(
            GetCredentialResponse response,
            String rawNonce,
            AuthCallback callback
    ) {
        try {
            Credential credential = response.getCredential();
            if (credential instanceof CustomCredential) {
                CustomCredential customCredential = (CustomCredential) credential;
                if (GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
                    try {
                        GoogleIdTokenCredential googleIdToken = GoogleIdTokenCredential.createFrom(customCredential.getData());
                        String idToken = googleIdToken.getIdToken();

                        if (idToken == null || idToken.trim().isEmpty()) {
                            callback.onError("EMPTY_TOKEN", "Google Identity returned an empty ID token.");
                            return;
                        }

                        AuthResult result = new AuthResult();
                        result.idToken = idToken;
                        result.email = googleIdToken.getId();
                        result.displayName = googleIdToken.getDisplayName();
                        result.givenName = googleIdToken.getGivenName();
                        result.familyName = googleIdToken.getFamilyName();
                        Uri pic = googleIdToken.getProfilePictureUri();
                        result.photoUrl = pic != null ? pic.toString() : null;
                        result.phoneNumber = googleIdToken.getPhoneNumber();
                        result.nonce = rawNonce;

                        callback.onSuccess(result);
                    } catch (Exception pe) {
                        Log.e(TAG, "Failed to parse Google ID token credential", pe);
                        callback.onError("PARSE_ERROR", "Failed to parse Google ID token credential: " + pe.getMessage());
                    }
                } else {
                    callback.onError("UNEXPECTED_CREDENTIAL", "Unexpected credential type: " + customCredential.getType());
                }
            } else {
                callback.onError("UNSUPPORTED_CREDENTIAL", "Unsupported credential format: " + credential.getClass().getName());
            }
        } catch (Exception e) {
            Log.e(TAG, "Exception processing credential response", e);
            callback.onError("RESPONSE_PROCESSING_ERROR", "Error processing Google sign-in response: " + e.getMessage());
        }
    }

    public void signOut(@NonNull final SignOutCallback callback) {
        try {
            ClearCredentialStateRequest clearRequest = new ClearCredentialStateRequest();
            CancellationSignal cancellationSignal = new CancellationSignal();
            Executor mainExecutor = ContextCompat.getMainExecutor(activity);

            credentialManager.clearCredentialStateAsync(
                    clearRequest,
                    cancellationSignal,
                    mainExecutor,
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override
                        public void onResult(Void unused) {
                            callback.onComplete();
                        }

                        @Override
                        public void onError(ClearCredentialException e) {
                            Log.w(TAG, "Clear credential state error: " + e.getMessage());
                            callback.onComplete();
                        }
                    }
            );
        } catch (Exception e) {
            Log.w(TAG, "Clear credential state exception: " + e.getMessage());
            callback.onComplete();
        }
    }
}
