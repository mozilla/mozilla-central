function cleanup() {
  gc();

  if (profileDir.exists())
    profileDir.remove(true);
}
