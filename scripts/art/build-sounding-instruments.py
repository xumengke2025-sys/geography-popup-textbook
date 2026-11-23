"""Pack the real mechanisms and each comparison setting in native Blender scenes."""
from pathlib import Path
from importlib.util import module_from_spec,spec_from_file_location
base=Path(__file__).resolve().parent
spec=spec_from_file_location('bench_transfer',base/'build-pneumatic-observers.py')
bench=module_from_spec(spec)
spec.loader.exec_module(bench)
bench.source=base.parents[1]/'work/sounding-blender-transfer'
bench.build('air-composition','百格空气组成取样器',['干洁空气','抽取水汽与杂质样本'],28,[0,0],45)
bench.build('atmosphere','手摇探空剖面观测器',['对流层','平流层','高层大气'],31,[.12,.42,.82],70)
