The split here is Directory SDK for C versus Directory SDK for Java.

The content is the very latest I have... but I have been tardy in reading
the developer Wiki, so perhaps some of what I've done is out of sync. I mean
Anton has reviewed the C SDK content and I've updated that to account for
his review comments. Also, I added what was necessary to cover the new
sample code I wrote (and I think Anton checked in). But it might not do
blindly to overwrite anything on the Wiki with what I have here. And it
might require a little post-update Wiki gardening to remove weeds.

The Directory SDK for C guide includes reference material. The Directory SDK
for Java guide does not, since there should be Javadoc somewhere. If this
assumption is wrong, let me know. I had a script to do that in my home dir
at work.

This version has the proper license as per
https://bugzilla.mozilla.org/show_bug.cgi?id=369156

The top files for each book are named 00-Programmers-Guide.book, so all
the other files are then pulled in through SYSTEM entities. In other words
run validation on the .books.

Hope it helps,
mark.craig@gmail.com, June 19, 2007
