Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
serverScript = fso.BuildPath(rootDir, "bridge\server.mjs")

If Not fso.FileExists(serverScript) Then
  MsgBox "Cannot find bridge\server.mjs in: " & rootDir, 16, "Chrome Incident Drawer"
  WScript.Quit 1
End If

cmd = "cmd /c cd /d """ & rootDir & """ && node """ & serverScript & """"
shell.Run cmd, 0, False
