	org 0x4000

data_addr equ 0x5000

sqt_init:
	ld a,008h
	ld (lc4b7h),a
	ld (lc4d4h),a
	ld (lc4f1h),a
	ld bc,00101h
	call sub_c13ah
offset_8
	ld hl,(data_addr + 0x0008)
	ld ix,lc4b7h
	call sub_c091h
	call sub_c08ah
	call sub_c08ah
	ld de,0073fh
lc024h:
	call sub_c080h
	ld e,000h
	inc d	
	ld a,d	
	cp 00ch
	jr nz,lc024h
	ret	
sqt_play:
	ld hl,lc50eh  ; counts down number of frames until next pattern row
	dec (hl)	
	jr nz,lc05fh
pc037h:
	ld (hl),001h  ; reset frames-until-next-row counter
	inc hl	; lc50fh - rows-to-next-pattern counter
	dec (hl)	
	ld a,(hl)	
	or a	
	call z,sub_c0ddh
	cp 004h
	call c,sub_c08ah
	ld ix,lc4b7h
	ld c,024h
	call sub_c144h
	ld ix,lc4d4h
	ld c,012h
	call sub_c144h
	ld ix,lc4f1h
	ld c,009h
	call sub_c144h
lc05fh:
	xor a	
	ld l,a	
	ld h,a	
	ld (lc072h+1),hl
	ld ix,lc4b7h
	call sub_c30eh
	call sub_c30eh
	call sub_c30eh
lc072h:
	ld bc,00000h
	ld a,b	
	rla	
	rla	
	rla	
	or c	
	cpl	
pc07ch:
	or 000h
	ld e,a	
	ld d,007h
sub_c080h:
	ld bc,0fffdh
	out (c),d
	ld b,0bfh
	out (c),e
	ret	
sub_c08ah:  ; read pattern info for 'next' channel
	ld hl,0e00ch  ; some sort of pattern/position address pointer
		; (but changing it is staggered across three rows)
		; Increments by 7 each pattern: 2 for each channel, then an extra one
pc08fh:
	ld ix,lc50eh  ; pattern info area.
		; usually points to lc4b7, becomes c4d4 / c4f1 / c50e for one pattern each
		; at the end of each frame. Advanced at the end of this routine (just above sub_c0ddh)
		; and reset in sub_c0ddh (just above lc128h).
		; c50e is the frame counter, so that's probably not a meaningful state.
sub_c091h:  ; alternative entry point for sub_c08ah where the caller specifies hl/ix
	ld a,(hl)	
	or a	; test for zero marker at end of position list
	jr nz,lc098h
offset_a:
	ld hl,(data_addr + 0x000a)  ; reset to start of position list
	ld a,0xff  ; ADDED FOR COWBELL - mark 'end of position list was encountered'
	ld (0xffff),a  ; ADDED FOR COWBELL
lc098h:
	ld b,(hl)	
	rl b
	res 5,(ix+000h)
	jr nc,lc0a5h
	set 5,(ix+000h)
lc0a5h:
	inc hl	
	ld a,(hl)	
	and 00fh
	ld (ix+01ah),a
	ld a,(hl)	
	and 0f0h
	rra	
	rra	
	rra	
	rra	
	cp 009h
	jr c,lc0bah
	sub 009h
	cpl	
lc0bah:
	ld (ix+018h),a
	inc hl	
	ld (sub_c08ah+1),hl
	ld l,b	
	ld h,000h
offset_6:
	ld de,(data_addr + 0x0006)
	add hl,de	
	ld e,(hl)	
	inc hl	
	ld d,(hl)	
	inc de	
	ld (ix+016h),e
	ld (ix+017h),d
	; advance to next channel's pattern info area
	ld de,0001dh
	add ix,de
	ld (pc08fh+2),ix
	ret	
sub_c0ddh:  ; end of pattern - fetch next one

	; --- ADDITION FOR COWBELL ---
	; The loop point is the first time we execute this after having reset the position list pointer
	; - which is marked by setting 0xffff to 0xff. When this becomes 0xfe, we know we've looped.
	ld a,(0xffff)
	xor 1
	ld (0xffff),a
	; --- END COWBELL ADDITION ---

	ld a,(lc4d1h)
	ld (lc4c2h),a
	ld a,(lc4eeh)
	ld (lc4dfh),a
	ld a,(lc50bh)
	ld (lc4fch),a
	ld hl,(lc4cdh)  ; possibly points to the position data for the first channel?
		; (changes every pattern, but repeats previously-seen values)
	dec hl	
	ld b,(hl)	
	inc hl	
	ld (lc4c9h),hl
	ld hl,(lc4eah)
	ld (lc4e6h),hl
	ld hl,(lc507h)
	ld (lc503h),hl
	ld hl,(lc4cfh)
	ld (lc4cbh),hl
	ld hl,(lc4ech)
	ld (lc4e8h),hl
	ld hl,(lc509h)
	ld (lc505h),hl
	ld hl,(sub_c08ah+1) ; get position data addr (to read last byte of record, the tempo)
	ld c,(hl)	; read tempo into c
	inc hl	
	ld (sub_c08ah+1),hl ; write back to position data ptr (now pointing to next position record)
	ld hl,lc4b7h ; reset pointer to per-channel pattern info area -
		; this will get used shortly before the end of the pattern as we read in the data
		; for the next position.
	ld (pc08fh+2),hl
	ld a,003h
	ld d,000h
lc128h:
	res 4,(hl)
	bit 5,(hl)
	jr z,lc130h
	set 4,(hl)
lc130h:
	ld e,015h
	add hl,de	
	ld (hl),d	
	ld e,008h
	add hl,de	
	dec a	
	jr nz,lc128h
sub_c13ah:
	ld (lc50eh),bc
	ld a,c	
lc13fh:
	ld (pc037h+1),a
	ld a,b	
	ret	
sub_c144h:
	ld a,(ix+015h)
	or a	
	jr z,lc154h
	dec (ix+015h)
	bit 7,(ix+000h)
	jr nz,lc191h
	ret	
lc154h:
	ld e,(ix+012h)
	ld d,(ix+013h)
	set 6,(ix+000h)
	res 7,(ix+000h)
	ld a,(de)	
	inc de	
	bit 7,a
	jr z,lc1b5h
	ld (ix+012h),e
	ld (ix+013h),d
	ld b,a	
	bit 6,a
	jr z,lc17fh
	dec de	
	ld (ix+01bh),e
	ld (ix+01ch),d
lc17ah:
	and 01fh
	jp lc2a8h
lc17fh:
	bit 5,a
	jr nz,lc1a4h
	and 00fh
	bit 4,b
	jr z,lc18bh
	neg
lc18bh:
	add a,(ix+00ch)
	ld (ix+00ch),a
lc191h:
	ld e,(ix+01bh)
	ld d,(ix+01ch)
	res 6,(ix+000h)
	ld a,(de)	
	bit 7,a
	jr nz,lc17ah
	inc de	
	jp lc283h
lc1a4h:
	and 00fh
	ld (ix+015h),a
	bit 4,b
	ret z	
	or a	
	jr z,lc191h
	set 7,(ix+000h)
	jr lc191h
lc1b5h:
	cp 060h
	jp c,lc269h
	sub 060h
	cp 00fh
	jr c,lc1d1h
	ld hl,pc07ch+1
	ld b,a	
	ld a,(hl)	
	or c	
	ld (hl),a	
	set 3,(ix+000h)
	ld a,b	
	sub 00fh
	jp z,lc27ch
lc1d1h:
	dec a	
	ex de,hl	
	ld c,(hl)	
	inc hl	
	bit 6,(ix+000h)
	jr z,lc1e5h
	ld (ix+012h),l
	ld (ix+013h),h
	res 6,(ix+000h)
lc1e5h:
	cp 008h
	jr c,lc1fah
	set 0,(ix+000h)
	ld l,c	
	ld e,a	
	ld d,00dh
	call sub_c080h
	ld d,00bh
	ld e,l	
	jp sub_c080h
lc1fah:
	cp 006h
	jr nc,lc24dh
	bit 4,(ix+000h)
	ret z	
	or a	
	jr nz,lc20dh
	ld a,c	
lc207h:
	and 00fh
	ld (ix+00bh),a
	ret	
lc20dh:
	dec a	
	jr nz,lc216h
	ld a,c	
	add a,(ix+00bh)
	jr lc207h
lc216h:
	dec a	
	jr nz,lc224h
	ld a,c	
	ld (lc4c2h),a
	ld (lc4dfh),a
	ld (lc4fch),a
	ret	
lc224h:
	dec a	
	jr nz,lc238h
	ld b,003h
	ld de,0001dh
	ld hl,lc4c2h
lc22fh:
	ld a,(hl)	
	add a,c	
	and 00fh
	ld (hl),a	
	add hl,de	
	djnz lc22fh
	ret	
lc238h:
	ld hl,lc50eh
	dec a	
	jr nz,lc249h
	ld a,c	
lc23fh:
	and 01fh
	jr nz,lc245h
	ld a,020h
lc245h:
	ld (hl),a	
	jp lc13fh
lc249h:
	ld a,(hl)	
	add a,c	
	jr lc23fh
lc24dh:
	sub 006h
	ld b,000h
	ld a,c	
	ld c,b	
	jr nz,lc258h
	dec b	
	neg
lc258h:
	set 2,(ix+000h)
	ld (ix+00dh),c
	ld (ix+00eh),c
	ld (ix+00fh),a
	ld (ix+010h),b
	ret	
lc269h:
	ld (ix+00ch),a
	dec de	
	ld (ix+01bh),e
	ld (ix+01ch),d
	inc de	
	call lc283h
	bit 6,(ix+000h)
	ret z	
lc27ch:
	ld (ix+012h),e
	ld (ix+013h),d
	ret	
lc283h:
	ld a,(de)	
	inc de	
	bit 7,a
	jr z,lc2a5h
	ld b,a	
	rra	
	and 01fh
	call nz,lc2a8h
	bit 6,b
	ret z	
	ld a,(de)	
	and 0f0h
	rr b
	rra	
	rra	
	rra	
	srl a
	call nz,sub_c2d9h
	ld a,(de)	
	inc de	
	and 00fh
	ret z	
lc2a5h:
	jp lc1d1h
lc2a8h:
	push bc	
	add a,a	
	ld c,a	
	ld b,000h
	ld a,(ix+000h)
	and 0f0h
	ld (ix+000h),a
offset_2:
	ld hl,(data_addr + 0x0002)
	add hl,bc	
	ld c,(hl)	
	inc hl	
	ld b,(hl)	
	push ix
	pop hl	
	inc hl	
	ld (hl),c	
	inc hl	
	ld (hl),b	
	inc bc	
	inc bc	
	inc hl	
	ld (hl),c	
	inc hl	
	ld (hl),b	
	inc hl	
	ld (hl),020h
	inc hl	
	ld (pc2e5h+1),hl
	pop bc	
	ld hl,pc07ch+1
	ld a,(hl)	
	or c	
	xor c	
	ld (hl),a	
	ret	
sub_c2d9h:
	add a,a	
	ld c,a	
	ld b,000h
offset_4:
	ld hl,(data_addr + 0x0004)
	add hl,bc	
	ld c,(hl)	
	inc hl	
	ld b,(hl)	
pc2e5h:
	ld hl,00000h
	ld (hl),c	
	inc hl	
	ld (hl),b	
	inc hl	
	inc bc	
	inc bc	
	ld (hl),c	
	inc hl	
	ld (hl),b	
	inc hl	
	ld (hl),020h
	set 1,(ix+000h)
	ret	
lc2f8h:
	ld hl,lc072h+1
	rl (hl)
	inc hl	
	rl (hl)
	ld a,(ix+011h)
	add a,008h
	out (c),a
	ld b,0bfh
	out (c),e
	jp lc424h
sub_c30eh:
	ld l,(ix+003h)
	ld h,(ix+004h)
	ld bc,0fffdh
	ld d,(ix+000h)
	ld e,000h
	bit 3,d
	jr nz,lc2f8h
	ld a,(hl)	
	and 00fh
	jp nz,lc32fh
	bit 0,d
	jr z,lc335h
	ld e,010h
	jp lc335h
lc32fh:
	sub (ix+00bh)
	jr c,lc335h
	ld e,a	
lc335h:
	ld a,(ix+011h)
	add a,008h
	out (c),a
	ld b,0bfh
	out (c),e
	ld a,(hl)	
	inc hl	
	and 0f0h
	rra	
	rra	
	rra	
	ld d,006h
	ld e,(hl)	
	rl e
	bit 5,(hl)
	jr z,lc35ah
	adc a,000h
	ld b,0ffh
	out (c),d
	ld b,0bfh
	out (c),a
lc35ah:
	ld a,e	
	rla	
	ex de,hl	
	ld hl,lc072h+1
	rl (hl)
	inc hl	
	rla	
	rl (hl)
	ex de,hl	
	ld a,(hl)	
	and 01fh
	ld d,a	
	inc hl	
	ld e,(hl)	
	inc hl	
	push de	
	ld d,000h
	dec (ix+005h)
	jp nz,lc395h
	ld l,(ix+001h)
	ld h,(ix+002h)
	ld a,(hl)	
	inc hl	
	cp 020h
	ld c,(hl)	
	inc hl	
	jr nz,lc38dh
	set 3,(ix+000h)
	res 1,(ix+000h)
lc38dh:
	ld b,a	
	add a,a	
	add a,b	
	ld e,a	
	add hl,de	
	ld (ix+005h),c
lc395h:
	ld (ix+003h),l
	ld (ix+004h),h
	ld a,(ix+00ch)
	bit 1,(ix+000h)
	jr z,lc3ceh
	ld l,(ix+008h)
	ld h,(ix+009h)
	add a,(hl)	
	inc hl	
	dec (ix+00ah)
	jp nz,lc3c8h
	ex af,af'	
	ld l,(ix+006h)
	ld h,(ix+007h)
	ld a,(hl)	
	inc hl	
	cp 020h
	ld e,b	
	jr z,lc3c2h
	ld c,(hl)	
	ld e,a	
lc3c2h:
	inc hl	
	add hl,de	
	ld (ix+00ah),c
	ex af,af'	
lc3c8h:
	ld (ix+008h),l
	ld (ix+009h),h
lc3ceh:
	add a,(ix+014h)
	cp 02dh
	jr nc,lc3e0h
	add a,a	
	ld e,a	
	ld hl,lc42ah
	add hl,de	
	ld d,(hl)	
	inc hl	
	jp lc3e5h
lc3e0h:
	ld hl,lc457h
	ld e,a	
	add hl,de	
lc3e5h:
	ld e,(hl)	
	ex de,hl	
	pop de	
	bit 4,d
	res 4,d
	jr z,$+4
	add hl,de	
	ld bc,052edh   ; this 'ld bc,....' is redundant, but if the jr z,$+4 is taken, it becomes
	   ; sbc hl,de ;. Ewww, evil.
	bit 2,(ix+000h)
	jr z,lc40eh
	ld c,(ix+00dh)
	ld b,(ix+00eh)
	add hl,bc	
	ex de,hl	
	ld l,(ix+00fh)
	ld h,(ix+010h)
	add hl,bc	
	ld (ix+00dh),l
	ld (ix+00eh),h
	ex de,hl	
lc40eh:
	ld a,(ix+011h)
	add a,a	
	ld bc,0fffdh
	out (c),a
	ld b,0bfh
	out (c),l
	inc a	
	ld b,0ffh
	out (c),a
	ld b,0bfh
	out (c),h
lc424h:
	ld de,0001dh
	add ix,de
	ret	
lc42ah:
	db 0x0d, 0x5d, 0x0c, 0x9c, 0x0b, 0xe7
	db 0x0b, 0x3c, 0x0a, 0x9b, 0x0a, 0x02, 0x09, 0x73, 0x08, 0xeb, 0x08, 0x6b, 0x07, 0xf2, 0x07, 0x80
	db 0x07, 0x14, 0x06, 0xae, 0x06, 0x4e, 0x05, 0xf4, 0x05, 0x9e, 0x05, 0x4f, 0x05, 0x01, 0x04, 0xb9
	db 0x04, 0x75, 0x04, 0x35, 0x03, 0xf9, 0x03
lc457h: db 0xc0, 0x03, 0x8a, 0x03, 0x57, 0x03, 0x27, 0x02, 0xfa
	db 0x02, 0xcf, 0x02, 0xa7, 0x02, 0x81, 0x02, 0x5d, 0x02, 0x3b, 0x02, 0x1b, 0x01, 0xfc, 0x01, 0xe0
	db 0x01, 0xc5, 0x01, 0xac, 0x01, 0x94, 0x01, 0x7d, 0x01, 0x68, 0x01, 0x53, 0x01, 0x40, 0x01, 0x2e
	db 0x01, 0x1d, 0x01, 0x0d, 0xfe, 0xf0, 0xe2, 0xd6, 0xca, 0xbe, 0xb4, 0xaa, 0xa0, 0x97, 0x8f, 0x87
	db 0x7f, 0x78, 0x71, 0x6b, 0x65, 0x5f, 0x5a, 0x55, 0x50, 0x4c, 0x47, 0x43, 0x40, 0x3c, 0x39, 0x35
	db 0x32, 0x30, 0x2d, 0x2a, 0x28, 0x26, 0x24, 0x22, 0x20, 0x1e, 0x1c, 0x1b, 0x19, 0x18, 0x16, 0x15
	db 0x14, 0x13, 0x12, 0x11, 0x10, 0x0f, 0x0e
lc4b7h: db 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	db 0x00, 0x00
lc4c2h: db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02
lc4c9h: db 0x00, 0x00
lc4cbh: db 0x00, 0x00
lc4cdh: db 0x73, 0xcf
lc4cfh: db 0x00
	db 0x00
lc4d1h: db 0x00, 0x00, 0x00
lc4d4h: db 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
lc4dfh: db 0x00
	db 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
lc4e6h: db 0x00, 0x00
lc4e8h: db 0x00, 0x00
lc4eah: db 0x23, 0xcf
lc4ech: db 0x00, 0x00
lc4eeh: db 0x00, 0x00
	db 0x00
lc4f1h: db 0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
lc4fch: db 0x00, 0x00, 0x00, 0x00
	db 0x00, 0x00, 0x00
lc503h: db 0x00, 0x00
lc505h: db 0x00, 0x00
lc507h: db 0x71, 0xce
lc509h: db 0x00, 0x00
lc50bh: db 0x00, 0x00, 0x00
lc50eh: db 0x01, 0x01
