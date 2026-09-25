from compose import *
# オペレーター。紺のボブ、ヘッドセット、青緑の制服、白いえり、赤いリボン
BASE = {
 0: [(10,"oooooooooo")],
 1: [(7,"oooKKKKkkkkkooo")],
 2: [(5,"ooKKKKKKkkkkkkkkoo")],
 3: [(4,"oKKKKKkkkkkkkkkkkkqo")],
 4: [(3,"oKKKkkkkkkkkkkkkkkkkqo")],
 5: [(2,"oKKkkkkkkkkkkkkkkkkkkqqo")],
 6: [(2,"oKkKKKkkKKKKkkKKkkkkkqqo")],
 7: [(1,"oKkkkkkqkkkkkqkkkkkqkkqqo")],
 8: [(1,"oKkkkkqkkkkkqkkkkkqkkkqqqo")],
 9: [(1,"okkkkqkkkkkqkkkkkkqkkkkqqo")],
 10:[(1,"okkkqkkkkkkqkkkkkkkqkkkqqo")],
 11:[(1,"okkqakkkkaqkkkkkaqkkkkaqqo")],
 12:[(1,"okkqa"),(6,"aaaaaaaaaaaaaaaaaaa"),(24,"qqo")],
 13:[(1,"okkqa"),(6,"aaaaaaaaaaaaaaaaaaa"),(24,"qqo")],
 14:[(1,"okkqa"),(6,"aaaaaaaaaaaaaaaaaaa"),(24,"qqo")],
 15:[(1,"okkqa"),(6,"aaaaaaaaaaaaaaaaaab"),(24,"qqo")],
 16:[(1,"okkqb"),(6,"aaaaaaaaaaaaaaaaaab"),(24,"qqo")],
 17:[(1,"okkqb"),(6,"baaaaaaaaaaaaaaab"),(23,"qqqo")],
 18:[(1,"okkq"),(5,"obaaaaaaaaaaaaaab"),(22,"qqqqo")],
 19:[(1,"okkq"),(5,"ocbaaaaaaaaaaaab"),(21,"oqqqqo")],
 20:[(1,"okqq"),(5,"qocbaaaaaaaaaab"),(20,"oqqqo")],
 21:[(1,"okqq"),(5,"qqocbaaaaaaab"),(18,"oqqqo")],
 22:[(1,"oqqqo"),(6,"qqqoocbbbbo"),(17,"oqqo")],
 23:[(2,"ooo"),(5,"oqqo"),(9,"ooccbbo"),(16,"oooo")],
 24:[(6,"oo"),(10,"occbbo")],
 25:[(4,"oooooo"),(10,"occbbbo"),(17,"ooooooooo")],
 26:[(2,"ooTTTTTtwo"),(11,"ocbbo"),(16,"owtttttDDoo")],
 27:[(1,"oTTTTTtttwwo"),(12,"obbo"),(16,"owwtttttDDDo")],
 28:[(0,"oTTTTtttttwwwoRRoRRowwwtttttDDDo")],
 29:[(0,"oTTtttttttwwwwoRpRowwwwttttDDDDo")],
 30:[(0,"oTtttttttttwwRRoRRwwtttttttDDDDo")],
 31:[(0,"otttttttttttwwwoowwwttttttttDDDD")],
}
EYE = {  # 手前 5×5、奥 4×5。T/t/D = 瞳、w = 光
 'open':  (["ooooo","owTto","owtDo","otDDo",".ooo."], ["oooo","wTto","wtDo","tDDo"]),
 'wide':  (["ooooo","wwwww","wwTww","wwtww",".www."], ["oooo","wwww","wTww","wtww"]),
 'flat':  ([".....","ooooo","awtDo","atDDo","....."], ["....","oooo","wtDo","tDDo"]),
 'happy': ([".....",".ooo.","o...o",".....","....."], ["....",".oo.","o..o","...."]),
}
MOUTH = {
 'small':    [(20, 16, "oo")],
 'talk':     [(19, 16, "ooo"), (20, 15, "oRRo"), (21, 16, "oo")],
 'wavy':     [(20, 15, "o.o.o".replace('.', 'a')), (20, 15, ".o.o."), (21, 15, "o.o.o")],
 'yell':     [(19, 15, "oooo"), (20, 14, "owwwwo"), (21, 14, "oRRRRo"), (22, 15, "RpRo"), (22, 15, "oooo")],
 'flat':     [(20, 15, "ooo")],
 'flatOpen': [(19, 15, "ooo"), (20, 15, "oRo"), (21, 16, "o")],
 'smile':    [(19, 14, "o...o"), (20, 15, "ooo")],
 'bigSmile': [(19, 14, "ooooo"), (20, 14, "owwwo"), (21, 14, "oRpRo"), (22, 15, "ooo")],
}
def op_face(eye, mouth, brow=0, sweat=False, blush=False, fist=False, dy=0):
    g = G(32, 32)
    for y, parts in BASE.items():
        for x, s in parts: g.put([(y, x, s)])
    # まゆ(前髪のすぐ下)
    if brow < 0: g.put([(11, 9, "qq"), (11, 20, "qq")])
    near, far = EYE[eye]
    g.put([(12 + j, 9, r) for j, r in enumerate(near)])
    g.put([(12 + j, 18, r) for j, r in enumerate(far)])
    # 鼻
    g.put([(16, 21, "b"), (17, 21, "c")])
    g.put(MOUTH[mouth])
    if blush: g.put([(17, 8, "pp"), (17, 20, "p")])
    # ヘッドセット:頭のバンド、耳あて、マイク
    for x in range(4, 27):
        t = (x - 4) / 22
        import math
        y = round(11 - math.sin(t * math.pi) * 10.5)
        g.px(x, y, 'S'); g.px(x, y - 1, 's' if t < .55 else 'S')
    g.put([(12, 2, ".oo."), (13, 1, "ossSo"), (14, 1, "osRSo"), (15, 1, "ossSo"), (16, 1, "osSSo"), (17, 2, "ooo")])
    g.put([(18, 5, "S"), (19, 6, "S"), (20, 7, "SS"), (20, 9, "o"), (21, 9, "os"), (19, 10, "o")])
    if sweat: g.put([(8, 26, ".o"), (9, 25, "oTo"), (10, 25, "oTw"), (11, 25, "oTT"), (12, 26, "o")])
    if fist:
        g.put([(21, 24, ".oooo."), (22, 23, "oaaaab"), (23, 23, "occccb"), (24, 23, "oaaaab"), (25, 23, "occccb"), (26, 24, "oaabo"),
               (27, 23, "owwwwo"), (28, 23, "otTTDo"), (29, 23, "otTTDo"), (30, 23, "otTDDo"), (31, 23, "otTDDo")])
    return g
OP_FACES = [('open', 'small', 'talk', {}), ('wide', 'wavy', 'yell', {'brow': -1, 'sweat': True}),
            ('flat', 'flat', 'flatOpen', {'brow': -1}), ('happy', 'smile', 'bigSmile', {'brow': 1, 'blush': True, 'fist': True})]
if __name__ == '__main__':
    for i, (e, m0, m1, kw) in enumerate(OP_FACES):
        op_face(e, m0, **kw).save(f'fo{i}a.txt', 'pal_op.txt'); op_face(e, m1, **kw).save(f'fo{i}b.txt', 'pal_op.txt')
