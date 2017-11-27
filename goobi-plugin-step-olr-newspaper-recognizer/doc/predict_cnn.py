#!/usr/bin/env python

import mxnet as mx
import sys
import os
import json

if len(sys.argv) > 4:
    dirName = sys.argv[1]
    tempDirName = sys.argv[2]
    resultFile = sys.argv[3]
    modelFile = sys.argv[4]

    if not os.path.exists(tempDirName):
        os.makedirs(tempDirName)
    else:
        print "tmpDir exists. Please delete or choose another one"
        sys.exit(-1)

    files = sorted(os.listdir(dirName))

    with open(tempDirName + "/images.lst", "w+") as lstFile:
        
        i=0
        for f in files:
           print 'convert {0}/{1} -resize 500 -crop 500x500+0+0 {2}/{3}'.format(dirName, f, tempDirName, f.replace(".tif", ".jpg"))
           #os.system('convert {0}/{1} -resize 500 -crop 500x500+0+0 {2}/{3}'.format(dirName, f, tempDirName, f.replace(".tif", ".jpg")))
           os.system('/usr/local/bin/convert {0}/{1} -resize 500 -crop 500x500+0+0 {2}/{3}'.format(dirName, f, tempDirName, f.replace(".tif", ".jpg")))
           lstFile.write(str(i) + "\t" + "0.0000\t" + f.replace(".tif",".jpg") + "\n")
           i+=1
else:
    files = []
    with open(tempDirName + "/images.lst") as f:
        for line in f:
            files.append(line.split("\t")[2][:-1])

data_iter = mx.image.ImageIter(batch_size=1, data_shape=(3, 50, 50), resize=75, path_imglist=tempDirName + "/images.lst", path_root=tempDirName+"/")

model = mx.mod.Module.load(modelFile, 9)
model.bind(data_shapes=data_iter.provide_data, label_shapes=data_iter.provide_label)

results = []

for pred, i_batch, batch in model.iter_predict(data_iter):
    nparr = pred[0].asnumpy()
    result = nparr[0][0] - nparr[0][1]
    results.append({"filename": files[i_batch], "result": float(result)})

dirname=os.path.dirname
if not os.path.exists(dirname(resultFile)):
    os.makedirs(dirname(resultFile))

with open(resultFile, "w") as outfile:
    json.dump(results, outfile)

'''
prediction = model.predict(data_iter)

i=0
for result in prediction.asnumpy():
    result = (result[0]-result[1])
    print files[i] + "\t" + str(result)
    i+=1
'''
