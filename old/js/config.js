requirejs.config({
    appDir: ".",
    baseUrl: "js",
    paths: {
        //chart1:         ['//cdnjs.cloudflare.com/ajax/libs/Chart.js/1.0.2/Chart.min'],
        jquery:         ['//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min'],
        bootstrap:      ['//maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min'],
        chart1:         ['//cdn.rawgit.com/ahrex/Chart.js/b09a68353e95cbffbd1fae620c1577a0bb74cbf8/Chart'],
        html2canvas:    ['//html2canvas.hertzen.com/build/html2canvas'],
        jsPDF:          ['//mrrio.github.io/jsPDF/dist/jspdf.min'],
        //jsPDF:          ['//cdnjs.cloudflare.com/ajax/libs/jspdf/1.0.272/jspdf.min'],
        sweetalert:     ['//cdnjs.cloudflare.com/ajax/libs/sweetalert/1.1.3/sweetalert.min'],
        daterangepicker:['//cdnjs.cloudflare.com/ajax/libs/bootstrap-daterangepicker/2.1.13/daterangepicker.min'],
        moment:         ['//cdnjs.cloudflare.com/ajax/libs/moment.js/2.10.6/moment.min'],
        underscore:     [ '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min'],
        JSZip:          [ '//cdnjs.cloudflare.com/ajax/libs/jszip/2.0.0/jszip'],
        multiselect:    [ '/js/bootstrap-multiselect/bootstrap-multiselect'],
        main:           ['/js/main'],
        history:        ['/js/history'],
        demand:         ['/js/demand'],
        common:         ['/js/common']
    },
    shim: {
        main        : ['jquery'],
        history     : ['jquery'],
        bootstrap   : ['jquery'],
        multiselect : ['bootstrap', 'jquery'],
        jsPDF       : ['html2canvas'],
        JSZip       : {
            exports: 'JSZip'
        }
    }
});