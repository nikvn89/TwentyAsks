"""Small Direct Mode helpers; never chain evidence."""
import datetime

def hx(addr):
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    return str(addr)

def lo(addr):
    return hx(addr).lower()

def chain_warp(vm, iso: str):
    """vm.warp() alone does not change gl.message_raw['datetime']; write it directly."""
    vm.warp(iso)
    import genlayer.gl as gl
    gl.message_raw["datetime"] = iso


