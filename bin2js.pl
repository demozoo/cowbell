#!/usr/bin/perl -w

$file = $ARGV[0];

$variable = $ARGV[1];

open(FILE, "<$file") || die "can't open $file: $!";

@bytes = ();
while (read(FILE, $str, 512)) {
	push(@bytes, unpack("C*", $str));
}
close(FILE);
print "${variable} = new Uint8Array([" . join(',', @bytes) . "]);\n"
