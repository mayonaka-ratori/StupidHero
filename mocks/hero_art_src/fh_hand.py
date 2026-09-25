from compose import *
def rows_to_grid(segs, w=32, h=32):
    g = G(w, h)
    for y, parts in segs.items():
        for x, s in parts: g.put([(y, x, s)])
    return g
LOCK = ["11112", "H1112", "11122", "a1122", "aa123"]
S = {
 0: [(11,"oooooooooo")],
 1: [(8,"ooo1HHHH11111ooo")],
 2: [(6,"oo1HHH111111111122oo")],
 3: [(2,"ooo"),(5,"o1HH11111111111111122o")],
 4: [(1,"o1Ho"),(5,"R1H1111111111111111122o")],
 5: [(0,"o1H1"),(4,"rR11HHHH1111111111111122o")],
 6: [(0,"o112"),(4,"o3111111HHHHH1111111122o")],
 7: [(0,"o112"),(4,"o32"),(7,"11112"+"H111112"+"H11112"+"222"),(28,"o")],
 8: [(0,"o122"),(4,"o32"),(7,"H1112"+"1H11122"+"1H1122"+"232"),(28,"o")],
 9: [(0,"o122"),(4,"o32"),(7,"11122"+"11H1122"+"11H122"+"33o")],
 10:[(0,"o123"),(4,"o32"),(7,"a1122"+"a111122"+"a11123"+"33o")],
 11:[(0,"o223"),(4,"o32"),(7,"aa123"+"aa11223"+"aa1123"+"3o")],
 12:[(0,"o23o"),(4,"o32"),(7,"NBBBNNNNNNNNNNNNNNNN"),(27,"No")],
 13:[(0,"o23o"),(4,"o3"),(6,"NNNNNNNNNNNNNNNNNNNNNN"),(28,"o")],
 14:[(0,"o23o"),(4,"o3"),(6,"NNNNNNNNNNNNNNNNNNNNN"),(27,"o")],
 15:[(0,"o3o"),(3,"o23"),(6,"NNNNNNNNNNNNNNNNNNNN"),(26,"o")],
 16:[(1,"oo"),(3,"o23"),(6,"NNNNNNNNNNNNNNNNNNNN"),(26,"o")],
 17:[(3,"o23"),(6,"bNNNNNNNNNNaNNNNNNNNo")],
 18:[(3,"o23"),(6,"cbaaaaaaaaaaaaaaaab"),(25,"o")],
 19:[(3,"o233"),(7,"baaaaaaaaaaaaaac"),(23,"bo")],
 20:[(4,"o33"),(7,"cbaaaaaaaaaaaaab"),(23,"o")],
 21:[(4,"oo3"),(7,"obaaaaaaaaaaaab"),(22,"o")],
 22:[(7,"oobbaaaaaaaaab"),(21,"o")],
 23:[(9,"oocbbaaaabbo")],
 24:[(10,"o"),(11,"occbbbbo")],
 25:[(4,"ooooooo"),(11,"occbbbo"),(18,"ooooooooo")],
 26:[(2,"ooRRRRRRRo"),(11,"occbbo"),(17,"oBNoRrrrrdoo")],
 27:[(1,"oRRRRrrrrr2o"),(12,"obbo"),(16,"oBBNNo2rrrrrddo")],
 28:[(0,"oRRrrrrrr23"),(11,"LLBBoooBBBBN"),(23,"N32rrrddo")],
 29:[(0,"oRrrrrrrr3o"),(11,"LLBBBB1BBBBN"),(23,"No3rrrddo")],
 30:[(0,"orrrrrrrdoL"),(11,"LBBB11H11BBN"),(23,"NNo3rrddo")],
 31:[(0,"orrrrrrdoLL"),(11,"LBBBB121BBBN"),(23,"NNo3rrddo")],
}
EYE = {  # [手前の目 5×4, 奥の目 4×4]
 'normal':  (["ooooo","wwLBN","wwBNN","Nwww"], ["oooo","wLBN","wBNN","Nww"]),
 'smug':    (["NNNNN","ooooo","wwBNN","Nwww"], ["NNNN","oooo","wBNN","Nww"]),
 'happy':   (["NaaaN","aoooa","oaaao","NaaaN"], ["NaaN","aooa","oaao","NaaN"]),
 'squeeze': (["ooaaN","aaooa","ooaaN","NaaaN"], ["Naoo","aoaa","Naoo","NaaN"]),
}
MOUTH = {
 'smirk':     [(20, 20, "o"), (21, 17, "ooo")],
 'smirkOpen': [(20, 18, "ooo"), (21, 17, "odRo"), (22, 18, "oo")],
 'wavy':      [(20, 17, "a.o.o".replace('.', 'a')), (20, 17, ".o.o."), (21, 17, "o.o.o")],
 'wail':      [(19, 17, "ooo"), (20, 16, "odddo"), (21, 16, "odRdo"), (22, 17, "ooo")],
 'smile':     [(20, 16, "o...o"), (21, 17, "ooo")],
 'bigSmile':  [(20, 16, "ooooo"), (21, 16, "owwwo"), (22, 16, "odRdo"), (23, 17, "ooo")],
}
def hero_face(eye, mouth, sweat=False, blush=False):
    g = rows_to_grid(S)
    near, far = EYE[eye]
    g.put([(13 + j, 10, r) for j, r in enumerate(near)])
    g.put([(13 + j, 20, r) for j, r in enumerate(far)])
    g.put([(18, 22, 'b'), (19, 22, 'c')])
    g.put(MOUTH[mouth])
    if blush: g.put([(18, 9, 'RR'), (18, 21, 'R')])
    if sweat: g.put([(8, 27, ".o"), (9, 26, "oLo"), (10, 26, "oLw"), (11, 26, "oLL"), (12, 27, "o")])
    return g
HERO_FACES = [('smug', 'smirk', 'smirkOpen', {}), ('squeeze', 'wavy', 'wail', {'sweat': True}), ('happy', 'smile', 'bigSmile', {'blush': True})]
if __name__ == '__main__':
    for i, (e, m0, m1, kw) in enumerate(HERO_FACES):
        hero_face(e, m0, **kw).save(f'fhh{i}a.txt'); hero_face(e, m1, **kw).save(f'fhh{i}b.txt')
