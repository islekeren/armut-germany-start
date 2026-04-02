"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts";
import {
  authApi,
  getStoredAccessToken,
  uploadsApi,
  usersApi,
} from "@/lib/api";
import { FormInput } from "@/components/forms/FormInput";
import { FormLabel } from "@/components/forms/FormLabel";
import { PanelCard } from "@/components/ui/PanelCard";

type NotificationPreferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  marketingEmails: false,
};

interface AccountSettingsContentProps {
  roleLabel: string;
}

export function AccountSettingsContent({ roleLabel }: AccountSettingsContentProps) {
  const { user, refreshAuth, logout } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const preferenceStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `armut_settings_preferences_${user.id}`;
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await usersApi.getProfile(token);
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setProfileImage(profile.profileImage || null);
      } catch (error) {
        console.error("Failed to load settings profile", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!preferenceStorageKey) return;

    const raw = localStorage.getItem(preferenceStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as NotificationPreferences;
      setPreferences({
        emailNotifications: !!parsed.emailNotifications,
        pushNotifications: !!parsed.pushNotifications,
        smsNotifications: !!parsed.smsNotifications,
        marketingEmails: !!parsed.marketingEmails,
      });
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [preferenceStorageKey]);

  const handleProfileSave = async () => {
    setIsSavingProfile(true);
    setProfileMessage("");

    try {
      const token = getStoredAccessToken();
      if (!token) {
        setProfileMessage("Please log in again.");
        return;
      }

      let nextProfileImage = profileImage;
      if (selectedImage) {
        const uploaded = await uploadsApi.uploadProfileImage(token, selectedImage);
        nextProfileImage = uploaded.url;
      }

      const updated = await usersApi.updateProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        profileImage: nextProfileImage || undefined,
      });

      setFirstName(updated.firstName || "");
      setLastName(updated.lastName || "");
      setPhone(updated.phone || "");
      setProfileImage(updated.profileImage || null);
      setSelectedImage(null);

      await refreshAuth();
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      console.error("Failed to update settings profile", error);
      setProfileMessage("Could not update your profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePreferencesSave = async () => {
    setIsSavingPreferences(true);
    setPreferencesMessage("");
    try {
      if (preferenceStorageKey) {
        localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
      }
      setPreferencesMessage("Preferences saved.");
    } catch (error) {
      console.error("Failed to save preferences", error);
      setPreferencesMessage("Could not save preferences.");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handlePasswordSave = async () => {
    setIsChangingPassword(true);
    setPasswordMessage("");

    try {
      const token = getStoredAccessToken();
      if (!token) {
        setPasswordMessage("Please log in again.");
        return;
      }

      if (newPassword.length < 8) {
        setPasswordMessage("New password must be at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordMessage("New passwords do not match.");
        return;
      }

      await authApi.changePassword(token, {
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } catch (error) {
      console.error("Failed to change password", error);
      setPasswordMessage("Could not change your password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteMessage("");
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      setDeleteMessage('Type "DELETE" to confirm.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setDeleteMessage("Please log in again.");
        return;
      }

      await usersApi.deleteProfile(token);
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to delete profile", error);
      setDeleteMessage("Could not delete your account.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading) {
    return (
      <PanelCard>
        <p className="text-sm text-muted">Loading account settings...</p>
      </PanelCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted">
          Update your {roleLabel.toLowerCase()} account details.
        </p>

        <div>
          <FormLabel htmlFor="settings-first-name">First name</FormLabel>
          <FormInput
            id="settings-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-last-name">Last name</FormLabel>
          <FormInput
            id="settings-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-email">Email</FormLabel>
          <FormInput id="settings-email" value={email} readOnly />
          <p className="mt-1 text-xs text-muted">
            Email is managed during account registration.
          </p>
        </div>

        <div>
          <FormLabel htmlFor="settings-phone">Phone</FormLabel>
          <FormInput
            id="settings-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-profile-image">Profile image</FormLabel>
          <FormInput
            id="settings-profile-image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelectedImage(file);
            }}
          />
          {profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileImage}
              alt="Profile preview"
              className="mt-3 h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : null}
        </div>

        {profileMessage ? <p className="text-sm text-muted">{profileMessage}</p> : null}

        <button
          type="button"
          onClick={handleProfileSave}
          disabled={isSavingProfile}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isSavingProfile ? "Saving..." : "Save profile"}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted">
          Control which updates we send to you.
        </p>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>Email notifications</span>
          <input
            type="checkbox"
            checked={preferences.emailNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                emailNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>Push notifications</span>
          <input
            type="checkbox"
            checked={preferences.pushNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                pushNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>SMS notifications</span>
          <input
            type="checkbox"
            checked={preferences.smsNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                smsNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>Marketing emails</span>
          <input
            type="checkbox"
            checked={preferences.marketingEmails}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                marketingEmails: event.target.checked,
              }))
            }
          />
        </label>

        {preferencesMessage ? (
          <p className="text-sm text-muted">{preferencesMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={handlePreferencesSave}
          disabled={isSavingPreferences}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isSavingPreferences ? "Saving..." : "Save preferences"}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted">Change your password.</p>

        <div>
          <FormLabel htmlFor="settings-current-password">Current password</FormLabel>
          <FormInput
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-new-password">New password</FormLabel>
          <FormInput
            id="settings-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-confirm-password">Confirm new password</FormLabel>
          <FormInput
            id="settings-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {passwordMessage ? <p className="text-sm text-muted">{passwordMessage}</p> : null}

        <button
          type="button"
          onClick={handlePasswordSave}
          disabled={isChangingPassword}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isChangingPassword ? "Updating..." : "Change password"}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4 border border-error/40">
        <h2 className="text-lg font-semibold text-error">Danger zone</h2>
        <p className="text-sm text-muted">
          Delete this account permanently. This action cannot be undone.
        </p>

        <div>
          <FormLabel htmlFor="settings-delete-confirm">Type DELETE to confirm</FormLabel>
          <FormInput
            id="settings-delete-confirm"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
          />
        </div>

        {deleteMessage ? <p className="text-sm text-error">{deleteMessage}</p> : null}

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-60"
        >
          {isDeletingAccount ? "Deleting..." : "Delete account"}
        </button>
      </PanelCard>
    </div>
  );
}
