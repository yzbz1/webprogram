Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "d:\WorkSpaceAi\webprogram\douyin-local"
WshShell.Run "node server\index.mjs", 0, False
