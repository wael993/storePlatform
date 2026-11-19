Password Reset via Superadmin
Description

When a user cannot log in because they have entered an incorrect password, they can request a password reset.

The reset request is sent to the Superadmin. The Superadmin can then reset the user's password to the predefined temporary password W123-456z.

After the Superadmin successfully resets the password, the Superadmin receives a success toast/message confirming that the password was reset successfully.

User Flow
User attempts to log in with an incorrect password.
User clicks Reset Password.
A password reset request is created.
The Superadmin receives a notification about the reset request.
Superadmin opens the reset request.
Superadmin clicks Reset Password.
The user's password is reset to W123-456z.
The Superadmin receives a success toast confirming the password reset.
The user can log in using the temporary password.
Acceptance Criteria
User

A Reset Password option is available when the user cannot log in because of an incorrect password.

Clicking Reset Password creates a password reset request.

The request is sent to/visible by the Superadmin.

The user does not receive the password reset success toast.

Superadmin

Superadmin receives a notification when a user requests a password reset.

The notification identifies the user who requested the reset.

Superadmin can open the request.

Superadmin can reset the user's password.

The password is reset to the predefined temporary password W123-456z.

After a successful reset, the Superadmin sees a success toast.

The toast message is: "Password reset successfully."

If the reset fails, the Superadmin sees an appropriate error message.

The reset request status is updated after the password has been successfully reset.

Success Toast

"Password reset successfully."

Error Handling

If the password reset fails, the user's password must not be changed.

The Superadmin should receive an error toast explaining that the password reset was unsuccessful.

The reset request should remain unresolved if the operation fails.

Security Note

The temporary password W123-456z should not be exposed in notifications, logs, or other insecure areas.
